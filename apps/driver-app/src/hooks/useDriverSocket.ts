import { useCallback, useEffect, useRef, useState } from 'react';
import type { DispatchAssignment } from '../types';

export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error';

const DEFAULT_WS = 'ws://localhost:8080/v1/driver/stream';
const DEFAULT_FLEET = 'AMB-VSKP-07';

export function useDriverSocket(fleetId: string = DEFAULT_FLEET) {
  const [connectionState, setConnectionState] = useState<ConnState>('connecting');
  const [assignment, setAssignment] = useState<DispatchAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = `${import.meta.env.VITE_WS_DRIVER_URL || DEFAULT_WS}?fleet_id=${encodeURIComponent(
    fleetId,
  )}`;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    let intentional = false;

    const connect = () => {
      if (cancelled) return;
      clearTimer();
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
            payload?: DispatchAssignment;
            error?: string;
          };
          if (msg.error) {
            setError(msg.error);
            return;
          }
          if (msg.event === 'DISPATCH_ASSIGNMENT' && msg.payload) {
            setAssignment(msg.payload);
            setToast('INCOMING EMERGENCY DISPATCH');
          }
          if (msg.event === 'DRIVER_CONNECTED') {
            setToast(`Online as ${fleetId}`);
          }
        } catch {
          setError('Malformed WebSocket payload');
        }
      };

      ws.onerror = () => {
        if (cancelled || intentional) return;
        setConnectionState('error');
        setError('Driver stream error — retrying…');
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
      clearTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [url, fleetId]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const sendStatus = useCallback(
    (body: Record<string, unknown>) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(body));
        return true;
      }
      setError('Not connected — status not sent');
      return false;
    },
    [],
  );

  const clearAssignment = useCallback(() => setAssignment(null), []);

  return {
    connectionState,
    assignment,
    setAssignment,
    clearAssignment,
    error,
    toast,
    setToast,
    sendStatus,
  };
}
