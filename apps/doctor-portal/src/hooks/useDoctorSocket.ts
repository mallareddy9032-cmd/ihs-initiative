import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { WS_BASE } from '../api';
import type { Appointment } from '../types';

type ConnectionState = 'connecting' | 'live' | 'offline';

const WS_HEARTBEAT_MS = 15_000;

interface DoctorSocketState {
  connectionState: ConnectionState;
  appointments: Appointment[];
  setAppointments: Dispatch<SetStateAction<Appointment[]>>;
  toast: string | null;
  setToast: (msg: string | null) => void;
  lastEvent: string | null;
}

function upsertAppointment(list: Appointment[], apt: Appointment): Appointment[] {
  const safeIso = (value?: string) => value || '';
  const idx = list.findIndex((a) => a.id === apt.id);
  if (idx === -1) {
    return [apt, ...list].sort((a, b) => safeIso(a.when_iso).localeCompare(safeIso(b.when_iso)));
  }
  const next = list.slice();
  next[idx] = { ...next[idx], ...apt };
  return next.sort((a, b) => safeIso(a.when_iso).localeCompare(safeIso(b.when_iso)));
}

export function useDoctorSocket(enabled: boolean): DoctorSocketState {
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);

  const clearRetry = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatRef.current != null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearHeartbeat();
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionState('offline');
      clearRetry();
      return;
    }

    let cancelled = false;

    const startHeartbeat = (ws: WebSocket) => {
      clearHeartbeat();
      heartbeatRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'PING', timestamp: Date.now() }));
        }
      }, WS_HEARTBEAT_MS);
    };

    const connect = () => {
      if (cancelled) return;
      clearHeartbeat();
      setConnectionState('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${WS_BASE}/v1/doctor/stream`);
      } catch {
        setConnectionState('offline');
        const delay = Math.min(8000, 800 * 2 ** retryRef.current);
        retryRef.current += 1;
        timerRef.current = window.setTimeout(connect, delay);
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnectionState('live');
        startHeartbeat(ws);
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            event?: string;
            payload?: Appointment | Appointment[] | { appointments?: Appointment[]; message?: string };
          };
          const event = msg.event || '';
          if (event === 'PING' || event === 'PONG') return;
          setLastEvent(event);

          if (event === 'DOCTOR_CONNECTED') {
            const payload = msg.payload as { appointments?: Appointment[] };
            if (payload?.appointments?.length) {
              const normalized = payload.appointments
                .filter((a) => a && a.id)
                .map((a) => ({
                  ...a,
                  when_iso: a.when_iso || new Date().toISOString(),
                  patient_name: a.patient_name || 'Patient',
                  ihs_uid: a.ihs_uid || 'UNKNOWN',
                  status: a.status || 'queued',
                }));
              if (normalized.length) setAppointments(normalized);
            }
            return;
          }

          if (
            event === 'APPOINTMENT_QUEUED' ||
            event === 'CONSULT_STARTED' ||
            event === 'CONSULT_ENDED'
          ) {
            const apt = msg.payload as Appointment;
            if (apt?.id) {
              setAppointments((prev) => upsertAppointment(prev, apt));
              if (event === 'APPOINTMENT_QUEUED') {
                setToast(`New ${apt.title} · ${apt.patient_name}`);
              }
            }
            return;
          }

          if (event === 'PRESCRIPTION_ISSUED') {
            setToast('Digital script synced to patient Health Vault');
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        clearHeartbeat();
        setConnectionState('offline');
        if (cancelled) return;
        const delay = Math.min(8000, 800 * 2 ** retryRef.current);
        retryRef.current += 1;
        timerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearRetry();
      clearHeartbeat();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, clearRetry, clearHeartbeat]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  return {
    connectionState,
    appointments,
    setAppointments,
    toast,
    setToast,
    lastEvent,
  };
}
