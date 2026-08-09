'use client';

import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_BIOTECH_THEME } from '@ihs/types';
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
              <p className="ihs-micro">Command & Control Plane</p>
              <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#0F172A] md:text-5xl">
                Live operations.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4B5563]">
                Ananthapuramu GIS, fleet ERP, SLA telemetry, and privileged Super Admin controls —
                rendered in the Clinical Bio-Tech glass system.
              </p>
            </div>
            <StatusPulse label="Live Telemetry Queue" />
          </div>
        </FadeUp>

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-8">
            <SpotlightCard tone="deep">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                High-priority telemetry
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    Dispatch GIS
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">20</p>
                  <p className="text-xs text-emerald-50/70">Active pilot nodes</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    SLA Window
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">04:12</p>
                  <p className="text-xs text-emerald-50/70">Avg response · Ananthapur</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    Fleet ERP
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">14</p>
                  <p className="text-xs text-emerald-50/70">ALS units standby</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <SpringButton variant="soft">Fleet ERP</SpringButton>
                <Link href="/admin/super">
                  <SpringButton>Super Admin →</SpringButton>
                </Link>
              </div>
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-4">
            <SpotlightCard>
              <h2 className="font-serif text-2xl text-[#0F172A]">Role Gate</h2>
              <ul className="mt-4 space-y-2">
                {APP_ROLE_POLICY.operationsHub.map((role) => (
                  <li key={role} className="ihs-pill w-full justify-start font-mono">
                    {role}
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-2 text-xs text-[#4B5563]">
                <div className="flex justify-between">
                  <dt>Primary</dt>
                  <dd className="font-mono text-[#0F172A]">{IHS_BIOTECH_THEME.green.primary}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Deep</dt>
                  <dd className="font-mono text-[#0F172A]">{IHS_BIOTECH_THEME.green.deep}</dd>
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
