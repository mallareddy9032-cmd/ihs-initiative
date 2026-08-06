import { useCallback, useEffect, useRef, useState } from 'react';
import type { IncomingTransport } from '../types';

export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

const DEFAULT_WS = 'ws://localhost:8080/v1/hospital/stream';

export function useHospitalSocket() {
  const [connectionState, setConnectionState] = useState<ConnState>('connecting');
  const [incoming, setIncoming] = useState<IncomingTransport[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const url = import.meta.env.VITE_WS_HOSPITAL_URL || DEFAULT_WS;

  useEffect(() => {
    let cancelled = false;
    let intentional = false;

    const connect = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setConnectionState(attemptRef.current > 0 ? 'reconnecting' : 'connecting');

      const ws = new WebSocket(url);
      socketRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        attemptRef.current = 0;
        setConnectionState('open');
        setError(null);
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            event?: string;
            payload?: IncomingTransport & {
              bay_id?: string;
              er_doctor?: string;
              status?: string;
              label?: string;
            };
          };

          if (msg.event === 'INCOMING_TRANSPORT' && msg.payload?.case_id) {
            const p = msg.payload;
            const etaMin = typeof p.eta_minutes === 'number' ? p.eta_minutes : 8;
            setIncoming((prev) => {
              const next: IncomingTransport = {
                ...p,
                patient_age: p.patient_age ?? 54,
                triage_priority: p.triage_priority || 'RED',
                vitals: p.vitals || { hr: 110, spo2: 92, bp_sys: 100, bp_dia: 60 },
                eta_minutes: etaMin,
                eta_deadline_ms: Date.now() + etaMin * 60_000,
              };
              const others = prev.filter((x) => x.case_id !== next.case_id);
              return [next, ...others];
            });
            setToast(`Inbound: ${p.patient_name} · ${p.triage_priority}`);
          }

          if (msg.event === 'BAY_RESERVED' && msg.payload) {
            setToast(
              `Bay reserved: ${msg.payload.bay_id} · ${msg.payload.er_doctor || 'doctor assigned'}`,
            );
          }

          if (msg.event === 'ER_INTAKE_CONFIRMED' && msg.payload?.case_id) {
            setIncoming((prev) => prev.filter((x) => x.case_id !== msg.payload!.case_id));
            setToast(msg.payload.label || 'ER intake confirmed');
          }
        } catch {
          setError('Malformed hospital stream payload');
        }
      };

      ws.onerror = () => {
        if (cancelled || intentional) return;
        setConnectionState('error');
        setError('Hospital stream error — retrying…');
      };

      ws.onclose = () => {
        if (cancelled || intentional) {
          setConnectionState('closed');
          return;
        }
        setConnectionState('reconnecting');
        const delay = Math.min(15000, 800 * 2 ** attemptRef.current);
        attemptRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      cancelled = true;
      intentional = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
    };
  }, [url]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const removeCase = useCallback((caseId: string) => {
    setIncoming((prev) => prev.filter((x) => x.case_id !== caseId));
  }, []);

  return {
    connectionState,
    incoming,
    setIncoming,
    removeCase,
    toast,
    setToast,
    error,
  };
}
