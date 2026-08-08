'use client';

import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_DARK_THEME } from '@ihs/types';
import { AppShell } from '@/components/AppShell';
import { DispatchTelemetryPanel } from '@/components/DispatchTelemetryPanel';
import { FadeUp, PageStagger, SpotlightCard, SpringButton, StatusPulse } from '@/components/ui/motion';

export default function OperationsHubHomePage() {
  return (
    <AppShell title="Operations Hub" subtitle="ERP · Dispatch · Super Admin">
      <PageStagger className="space-y-6">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
                Immersive HUD
              </p>
              <h1 className="mt-2 font-serif text-4xl text-ihs-text md:text-5xl">
                Command & Control.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ihs-muted">
                Ananthapuramu GIS, fleet ERP, SLA telemetry, and privileged Super Admin controls —
                rendered as a high-contrast dark operations plane.
              </p>
            </div>
            <StatusPulse label="Live Telemetry Queue" tone="mint" />
          </div>
        </FadeUp>

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-8">
            <SpotlightCard className="p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    Dispatch GIS
                  </p>
                  <p className="mt-2 font-serif text-3xl text-ihs-mint">20</p>
                  <p className="text-xs text-ihs-muted">Active pilot nodes</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    SLA Window
                  </p>
                  <p className="mt-2 font-serif text-3xl text-amber-300">04:12</p>
                  <p className="text-xs text-ihs-muted">Avg response · Ananthapur</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    Fleet ERP
                  </p>
                  <p className="mt-2 font-serif text-3xl text-sky-300">14</p>
                  <p className="text-xs text-ihs-muted">ALS units standby</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <SpringButton className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ihs-muted">
                  Fleet ERP
                </SpringButton>
                <Link href="/admin/super">
                  <SpringButton className="rounded-xl border border-ihs-danger/40 bg-ihs-danger/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-300 shadow-glow-red">
                    Super Admin →
                  </SpringButton>
                </Link>
              </div>
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-4">
            <SpotlightCard className="h-full p-6">
              <h2 className="font-serif text-2xl text-ihs-text">Role Gate</h2>
              <ul className="mt-4 space-y-2">
                {APP_ROLE_POLICY.operationsHub.map((role) => (
                  <li
                    key={role}
                    className="rounded-xl border border-ihs-warning/25 bg-ihs-warning/10 px-3 py-2 font-mono text-sm text-amber-200"
                  >
                    {role}
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-2 text-xs text-ihs-muted">
                <div className="flex justify-between">
                  <dt>Canvas</dt>
                  <dd className="font-mono text-ihs-text">{IHS_DARK_THEME.canvas}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Deep</dt>
                  <dd className="font-mono text-ihs-text">{IHS_DARK_THEME.canvasDeep}</dd>
                </div>
              </dl>
            </SpotlightCard>
          </FadeUp>
        </div>

        <FadeUp>
          <DispatchTelemetryPanel />
        </FadeUp>
      </PageStagger>
    </AppShell>
  );
}
