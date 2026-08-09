'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SpotlightCard, StatusPulse, springSoft } from '@/components/ui/motion';

type TelemetryCase = {
  id: string;
  ihsUid: string;
  serviceType: string;
  status: string;
  priority: string;
  sector: string | null;
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
    <SpotlightCard>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ihs-micro">Live GIS HUD</p>
          <h2 className="font-serif text-2xl text-[#0F172A]">Dispatch Telemetry</h2>
          <p className="mt-1 text-sm text-[#4B5563]">
            <code className="text-[#143525]">TriageCase</code> ×{' '}
            <code className="text-[#143525]">DispatchRecord</code> · @ihs/db
          </p>
        </div>
        <StatusPulse
          label={data ? `${data.cases.length} cases · ${data.mode}` : 'syncing…'}
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="relative mb-4 h-64 overflow-hidden rounded-2xl border border-slate-200 bg-[#0D281E]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,197,94,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.18) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.55)]" />
        <p className="absolute left-1/2 top-[calc(50%+16px)] -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-emerald-100/80">
          {data?.center.label ?? 'Ananthapuramu Core'}
        </p>
        {data?.cases.map((row, index) => {
          if (!row.dispatch) return null;
          const x = 50 + (row.dispatch.lng - (data.center.lng || 77.6)) * 1200;
          const y = 50 - (row.dispatch.lat - (data.center.lat || 14.68)) * 1200;
          return (
            <motion.div
              key={row.dispatch.id}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#22C55E]"
              style={{
                left: `${Math.min(92, Math.max(8, x))}%`,
                top: `${Math.min(88, Math.max(12, y))}%`,
              }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: index * 0.15 }}
              title={`${row.dispatch.callsign} · ETA ${row.dispatch.etaMins ?? '—'}m`}
            />
          );
        })}
      </div>

      <ul className="space-y-2">
        {(data?.cases ?? []).map((row, i) => (
          <motion.li
            key={row.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: i * 0.04 }}
            className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#0F172A]">
                {row.patient?.name ?? row.ihsUid}{' '}
                <span className="font-mono text-xs text-[#4B5563]">({row.priority})</span>
              </p>
              <span className="ihs-pill">{row.dispatch?.status ?? row.status}</span>
            </div>
            <p className="mt-1 text-xs text-[#4B5563]">
              {row.serviceType} · {row.sector ?? 'Sector n/a'} ·{' '}
              {row.dispatch
                ? `${row.dispatch.callsign ?? 'unit'} · ETA ${row.dispatch.etaMins ?? '—'}m · ${row.dispatch.lat.toFixed(4)}, ${row.dispatch.lng.toFixed(4)}`
                : 'No dispatch record'}
            </p>
          </motion.li>
        ))}
        {data && data.cases.length === 0 ? (
          <li className="text-sm text-[#4B5563]">No active triage / dispatch rows.</li>
        ) : null}
      </ul>
    </SpotlightCard>
  );
}
