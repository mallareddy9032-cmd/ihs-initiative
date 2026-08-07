// ============================================================================
// FILE: src/components/clinical/EcgLiveCanvas.tsx
// CONTEXT: Physician Console - 60fps Telemetry Rendering
// ============================================================================

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { decodeBase64ToFloat32 } from '@/utils/binaryDecoder';

interface EcgProps {
  caseId: string;
}

type StreamStatus = 'connecting' | 'live' | 'idle' | 'error';

export const EcgLiveCanvas: React.FC<EcgProps> = ({ caseId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const voltageQueueRef = useRef<number[]>([]);
  const xOffsetRef = useRef(0);
  const animationFrameRef = useRef<number>(0);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sweepSpeed = 2;
    const baseUrl =
      process.env.NEXT_PUBLIC_WS_TELEMETRY_URL || 'ws://localhost:8080/v1/telemetry/stream';
    const wsUrl = `${baseUrl.replace(/\/$/, '')}/${caseId}`;

    setStatus('connecting');
    setError(null);
    voltageQueueRef.current = [];
    xOffsetRef.current = 0;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let ws: WebSocket;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    const WS_HEARTBEAT_MS = 15_000;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setStatus('error');
      setError('Unable to open telemetry WebSocket.');
      return;
    }

    ws.onopen = () => {
      setStatus('idle');
      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'PING', timestamp: Date.now() }));
        }
      }, WS_HEARTBEAT_MS);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data as string) as {
          event?: string;
          service_uuid?: string;
          reading_value?: string;
        };

        if (payload.event === 'PING' || payload.event === 'PONG') return;

        // Filter for 12-Lead ECG UUID
        if (payload.service_uuid === '0x180D' && typeof payload.reading_value === 'string') {
          const voltages = decodeBase64ToFloat32(payload.reading_value);
          for (let i = 0; i < voltages.length; i++) {
            voltageQueueRef.current.push(voltages[i]);
          }
          // Bound memory during high-rate bursts
          if (voltageQueueRef.current.length > 10_000) {
            voltageQueueRef.current.splice(0, voltageQueueRef.current.length - 10_000);
          }
          setStatus('live');
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Malformed ECG telemetry frame.');
      }
    };

    ws.onerror = () => {
      setStatus('error');
      setError('Telemetry stream connection error.');
    };

    ws.onclose = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      setStatus((prev) => (prev === 'error' ? prev : 'idle'));
    };

    const drawFrame = () => {
      const queue = voltageQueueRef.current;
      if (queue.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#34C759'; // Apple HIG System Green
        ctx.lineWidth = 1.5;

        let started = false;
        // Drain a modest number of samples per frame to sustain ~60fps sweep
        const samplesThisFrame = Math.min(queue.length, 8);

        for (let i = 0; i < samplesThisFrame; i++) {
          const voltage = queue.shift();
          if (voltage === undefined) break;

          // Normalize voltage (-2.0mV to +2.0mV) to canvas height
          const y = canvas.height / 2 - voltage * (canvas.height / 4);

          if (!started || xOffsetRef.current === 0) {
            ctx.moveTo(xOffsetRef.current, y);
            started = true;
          } else {
            ctx.lineTo(xOffsetRef.current, y);
          }

          xOffsetRef.current += sweepSpeed;

          // Wrap-around logic with phosphor fade
          if (xOffsetRef.current >= canvas.width) {
            ctx.stroke();
            xOffsetRef.current = 0;
            ctx.fillStyle = 'rgba(242, 242, 247, 0.35)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.strokeStyle = '#34C759';
            ctx.lineWidth = 1.5;
            started = false;
          }
        }

        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    animationFrameRef.current = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      ws.close();
    };
  }, [caseId]);

  return (
    <div className="option-a-card border border-black/5 bg-white rounded-3xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
      <div className="flex justify-between text-[#8E8E93] font-mono text-xs mb-1">
        <span className="text-[#1C1C1E] font-bold">LEAD II (0x180D)</span>
        <span className="flex items-center gap-3">
          <span
            className={
              status === 'live'
                ? 'text-[#34C759]'
                : status === 'error'
                  ? 'text-[#FF2D55]'
                  : 'text-[#FF9500]'
            }
          >
            {status === 'connecting' && 'CONNECTING…'}
            {status === 'live' && '● LIVE 60fps'}
            {status === 'idle' && 'AWAITING SAMPLES'}
            {status === 'error' && 'STREAM ERROR'}
          </span>
          <span>25 mm/s | 10 mm/mV</span>
        </span>
      </div>

      {error && (
        <div role="alert" className="mb-2 text-xs text-[#FF2D55] font-mono">
          {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="w-full bg-white block rounded-2xl border border-black/5"
      />
    </div>
  );
};
