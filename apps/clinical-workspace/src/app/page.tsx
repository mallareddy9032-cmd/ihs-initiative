'use client';

import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_BIOTECH_THEME } from '@ihs/types';
import { AppShell } from '@/components/AppShell';
import {
  FadeUp,
  PageStagger,
  SpotlightCard,
  SpringButton,
  StatusPulse,
} from '@/components/ui/motion';

const QUEUE = [
  { id: 'Q-1842', name: 'Lakshmi Devi', acuity: 'P2', wait: '06m', chief: 'Fever · 2 days' },
  { id: 'Q-1843', name: 'Ravi Kumar', acuity: 'P1', wait: '02m', chief: 'Chest pain' },
  { id: 'Q-1844', name: 'Anitha Reddy', acuity: 'P3', wait: '14m', chief: 'Follow-up Rx' },
  { id: 'Q-1845', name: 'Suresh Babu', acuity: 'P2', wait: '09m', chief: 'Wound review' },
] as const;

export default function ClinicalWorkspaceHomePage() {
  return (
    <AppShell title="Clinical Workspace" subtitle="Consultation · Triage · E-Rx">
      <PageStagger className="space-y-6">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ihs-micro">Clinical Bio-Tech Desk</p>
              <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#0F172A] md:text-5xl">
                Consultation Queue.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4B5563]">
                Pull triage, open encrypted vaults, chart SOAP, and issue stock-aware e-prescriptions
                from one white-and-mint clinical plane.
              </p>
            </div>
            <StatusPulse label="Triage Desk Live" tone="sky" />
          </div>
        </FadeUp>

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-8">
            <SpotlightCard className="!rounded-3xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl text-[#0F172A]">Live Queue</h2>
                <span className="ihs-pill">{QUEUE.length} waiting</span>
              </div>
              <ul className="space-y-2">
                {QUEUE.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                  >
                    <div>
                      <p className="font-semibold text-[#0F172A]">
                        {row.name}{' '}
                        <span className="font-mono text-xs text-[#4B5563]">{row.id}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[#4B5563]">{row.chief}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase ${
                          row.acuity === 'P1'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : row.acuity === 'P2'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-[#E8F5E9] text-[#143525] border border-[#DCFCE7]'
                        }`}
                      >
                        {row.acuity}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#22C55E]">
                        {row.wait}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <SpringButton variant="ghost">Start Consult</SpringButton>
                <Link href="/clinical/chart">
                  <SpringButton>SOAP Chart →</SpringButton>
                </Link>
              </div>
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-4">
            <SpotlightCard className="!rounded-3xl">
              <h2 className="font-serif text-2xl text-[#0F172A]">Access Policy</h2>
              <p className="ihs-micro mt-2">Allowed roles</p>
              <ul className="mt-3 space-y-2">
                {APP_ROLE_POLICY.clinicalWorkspace.map((role) => (
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
                  <dt>Lime</dt>
                  <dd className="font-mono text-[#0F172A]">{IHS_BIOTECH_THEME.lime.accent}</dd>
                </div>
              </dl>
            </SpotlightCard>
          </FadeUp>
        </div>
      </PageStagger>
    </AppShell>
  );
}
