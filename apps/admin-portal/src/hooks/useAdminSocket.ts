import { useEffect, useRef, useState } from 'react';
import type { ExecutiveSnapshot } from '../types';

export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

export interface SimulationStep {
  step: number;
  total: number;
  status: 'running' | 'complete' | 'error';
  message: string;
  timestamp?: string;
}

const DEFAULT_WS = 'ws://localhost:8080/v1/admin/stream';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export function useAdminSocket() {
  const [connectionState, setConnectionState] = useState<ConnState>('connecting');
  const [snapshot, setSnapshot] = useState<ExecutiveSnapshot | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [simOpen, setSimOpen] = useState(false);
  const [simSteps, setSimSteps] = useState<SimulationStep[]>([]);
  const [simDone, setSimDone] = useState(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = import.meta.env.VITE_WS_ADMIN_URL || DEFAULT_WS;

  useEffect(() => {
    let cancelled = false;
    let intentional = false;

    const loadSnapshot = async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/admin/executive-snapshot`);
        if (!res.ok) return;
        const body = (await res.json()) as ExecutiveSnapshot;
        if (!cancelled) setSnapshot(body);
      } catch {
        // ignore — WS snapshot will cover
      }
    };

    void loadSnapshot();

    const connect = () => {
      if (cancelled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setConnectionState(attemptRef.current > 0 ? 'reconnecting' : 'connecting');

      const ws = new WebSocket(url);

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
            payload?: ExecutiveSnapshot | SimulationStep | Record<string, unknown>;
          };
          if (msg.event === 'EXECUTIVE_SNAPSHOT' && msg.payload) {
            setSnapshot(msg.payload as ExecutiveSnapshot);
          }
          if (msg.event === 'SIMULATION_PROGRESS' && msg.payload) {
            const p = msg.payload as SimulationStep;
            setSimOpen(true);
            setSimSteps((prev) => {
              const map = new Map(prev.map((s) => [s.step, s]));
              const existing = map.get(p.step);
              if (existing?.status === 'complete' && p.status === 'running') {
                return prev;
              }
              map.set(p.step, p);
              return Array.from(map.values()).sort((a, b) => a.step - b.step);
            });
            if (p.status === 'error') setSimDone(true);
          }
          if (msg.event === 'SIMULATION_COMPLETE') {
            setSimDone(true);
            setSimOpen(true);
          }
          if (msg.event && msg.event !== 'ADMIN_CONNECTED') {
            const stamp = new Date().toLocaleTimeString();
            setEvents((prev) => [`${stamp} · ${msg.event}`, ...prev].slice(0, 40));
          }
        } catch {
          setError('Malformed admin telemetry payload');
        }
      };

      ws.onerror = () => {
        if (cancelled || intentional) return;
        setConnectionState('error');
        setError('Admin stream error — retrying…');
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
    const poll = setInterval(() => void loadSnapshot(), 15000);

    return () => {
      cancelled = true;
      intentional = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(poll);
    };
  }, [url]);

  const resetSimulationUi = () => {
    setSimSteps([]);
    setSimDone(false);
    setSimOpen(false);
  };

  return {
    connectionState,
    snapshot,
    events,
    error,
    setSnapshot,
    simOpen,
    setSimOpen,
    simSteps,
    simDone,
    resetSimulationUi,
  };
}
