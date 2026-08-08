'use client';

import { useCallback, useEffect, useState } from 'react';

type TelemetryCase = {
  id: string;
  ihsUid: string;
  serviceType: string;
  status: string;
  priority: string;
  sector: string | null;
  latitude: number | null;
  longitude: number | null;
  patient: { ihsUid: string; name: string } | null;
  dispatch: {
    id: string;
    fleetId: string | null;
    callsign: string | null;
    status: string;
    lat: number;
    lng: number;
    etaMins: number | null;
    lastTelemetryAt: string;
  } | null;
};

type TelemetryPayload = {
  mode: string;
  generatedAt: string;
  center: { lat: number; lng: number; label: string };
  cases: TelemetryCase[];
};

export function DispatchTelemetryPanel() {
  const [data, setData] = useState<TelemetryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dispatch/telemetry', { cache: 'no-store' });
      const json = (await res.json()) as TelemetryPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Telemetry fetch failed.');
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Telemetry fetch failed.');
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      void load();
    }, 4000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <section className="glass-panel rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ihs-mint">
            Phase 4 · Live GIS
          </p>
          <h2 className="font-serif text-2xl text-ihs-text">Dispatch Telemetry</h2>
          <p className="mt-1 text-sm text-ihs-muted">
            Pulling <code className="text-ihs-mint">TriageCase</code> +{' '}
            <code className="text-ihs-mint">DispatchRecord</code> from @ihs/db
          </p>
        </div>
        <span className="rounded-full border border-ihs-olive/40 bg-ihs-olive/15 px-3 py-1 text-xs font-bold text-ihs-mint">
          {data ? `${data.cases.length} cases · ${data.mode}` : 'connecting…'}
        </span>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-ihs-danger/40 bg-ihs-danger/15 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <div className="relative mb-4 h-56 overflow-hidden rounded-xl border border-ihs-border bg-[#020617]">
        <div className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(61,220,151,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(61,220,151,0.12) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ihs-olive shadow-glow" />
        <p className="absolute left-1/2 top-[calc(50%+14px)] -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
          {data?.center.label ?? 'Ananthapuramu Core'}
        </p>
        {data?.cases.map((row, index) => {
          if (!row.dispatch) return null;
          const x = 50 + (row.dispatch.lng - (data.center.lng || 77.6)) * 1200;
          const y = 50 - (row.dispatch.lat - (data.center.lat || 14.68)) * 1200;
          return (
            <div
              key={row.dispatch.id}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(217,119,6,0.8)]"
              style={{
                left: `${Math.min(92, Math.max(8, x))}%`,
                top: `${Math.min(88, Math.max(12, y))}%`,
                animationDelay: `${index * 120}ms`,
              }}
              title={`${row.dispatch.callsign} · ETA ${row.dispatch.etaMins ?? '—'}m`}
            />
          );
        })}
      </div>

      <ul className="space-y-2">
        {(data?.cases ?? []).map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-ihs-border bg-black/30 px-4 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ihs-text">
                {row.patient?.name ?? row.ihsUid}{' '}
                <span className="font-mono text-xs text-ihs-muted">({row.priority})</span>
              </p>
              <span className="rounded-full bg-ihs-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                {row.dispatch?.status ?? row.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-ihs-muted">
              {row.serviceType} · {row.sector ?? 'Sector n/a'} ·{' '}
              {row.dispatch
                ? `${row.dispatch.callsign ?? 'unit'} · ETA ${row.dispatch.etaMins ?? '—'}m · ${row.dispatch.lat.toFixed(4)}, ${row.dispatch.lng.toFixed(4)}`
                : 'No dispatch record'}
            </p>
          </li>
        ))}
        {data && data.cases.length === 0 ? (
          <li className="text-sm text-ihs-muted">No active triage / dispatch rows.</li>
        ) : null}
      </ul>
    </section>
  );
}
