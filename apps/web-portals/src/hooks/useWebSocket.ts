// ============================================================================
// FILE: src/hooks/useWebSocket.ts
// CONTEXT: Persistent WebSocket hook with reconnect + graceful fallback
// ============================================================================

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface WsEnvelope {
  event?: string;
  payload?: unknown;
  [key: string]: unknown;
}

export type WsConnectionState =
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'
  | 'reconnecting';

export interface UseWebSocketResult {
  lastMessage: WsEnvelope | null;
  connectionState: WsConnectionState;
  error: string | null;
  send: (data: unknown) => void;
  reconnect: () => void;
}

const MAX_BACKOFF_MS = 15_000;
const BASE_BACKOFF_MS = 800;

export function useWebSocket(url: string | null): UseWebSocketResult {
  const [lastMessage, setLastMessage] = useState<WsEnvelope | null>(null);
  const [connectionState, setConnectionState] = useState<WsConnectionState>(
    url ? 'connecting' : 'closed',
  );
  const [error, setError] = useState<string | null>(null);
  const [reconnectToken, setReconnectToken] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!url) {
      setConnectionState('closed');
      setError(null);
      return;
    }

    intentionalCloseRef.current = false;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      clearReconnectTimer();
      setConnectionState(attemptRef.current > 0 ? 'reconnecting' : 'connecting');
      setError(null);

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (err) {
        setConnectionState('error');
        setError(err instanceof Error ? err.message : 'Failed to open WebSocket.');
        scheduleReconnect();
        return;
      }

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
          const parsed = JSON.parse(event.data as string) as WsEnvelope;
          setLastMessage(parsed);
        } catch {
          setError('Received malformed WebSocket payload.');
        }
      };

      ws.onerror = () => {
        if (cancelled || intentionalCloseRef.current) return;
        setConnectionState('error');
        setError('WebSocket connection error — will retry.');
      };

      ws.onclose = () => {
        if (cancelled) return;
        socketRef.current = null;
        if (intentionalCloseRef.current) {
          setConnectionState('closed');
          return;
        }
        setConnectionState('reconnecting');
        setError('Dispatch stream disconnected — reconnecting…');
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled || intentionalCloseRef.current) return;
      clearReconnectTimer();
      const attempt = attemptRef.current;
      const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt);
      attemptRef.current = attempt + 1;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    connect();

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      try {
        socketRef.current?.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    };
  }, [url, reconnectToken]);

  const send = useCallback((data: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const reconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    clearReconnectTimer();
    try {
      socketRef.current?.close();
    } catch {
      // ignore
    }
    socketRef.current = null;
    attemptRef.current = 0;
    setReconnectToken((token) => token + 1);
  }, []);

  return { lastMessage, connectionState, error, send, reconnect };
}
