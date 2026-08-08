'use client';

import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_DARK_THEME } from '@ihs/types';
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
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-300">
                Distractor-free desk
              </p>
              <h1 className="mt-2 font-serif text-4xl text-ihs-text md:text-5xl">
                Consultation Queue.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ihs-muted">
                Pull triage, open encrypted vaults, chart SOAP, and issue stock-aware e-prescriptions
                from one dark clinical plane.
              </p>
            </div>
            <StatusPulse label="Triage Desk Live" tone="sky" />
          </div>
        </FadeUp>

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-8">
            <SpotlightCard className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl text-ihs-text">Live Queue</h2>
                <span className="font-mono text-xs text-ihs-muted">{QUEUE.length} waiting</span>
              </div>
              <ul className="space-y-2">
                {QUEUE.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition-colors hover:border-white/20"
                  >
                    <div>
                      <p className="font-semibold text-ihs-text">
                        {row.name}{' '}
                        <span className="font-mono text-xs text-ihs-muted">{row.id}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ihs-muted">{row.chief}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          row.acuity === 'P1'
                            ? 'bg-ihs-danger/20 text-rose-300'
                            : row.acuity === 'P2'
                              ? 'bg-ihs-warning/20 text-amber-300'
                              : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {row.acuity}
                      </span>
                      <span className="font-mono text-xs text-ihs-mint">{row.wait}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <SpringButton className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ihs-muted">
                  Start Consult
                </SpringButton>
                <Link href="/clinical/chart">
                  <SpringButton className="rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sky-300">
                    SOAP Chart →
                  </SpringButton>
                </Link>
              </div>
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-4">
            <SpotlightCard className="h-full p-6">
              <h2 className="font-serif text-2xl text-ihs-text">Access Policy</h2>
              <p className="mt-2 text-xs uppercase tracking-wider text-ihs-muted">Allowed roles</p>
              <ul className="mt-3 space-y-2">
                {APP_ROLE_POLICY.clinicalWorkspace.map((role) => (
                  <li
                    key={role}
                    className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-2 font-mono text-sm text-sky-200"
                  >
                    {role}
                  </li>
                ))}
              </ul>
              <dl className="mt-6 space-y-2 text-xs text-ihs-muted">
                <div className="flex justify-between">
                  <dt>Surface</dt>
                  <dd className="font-mono text-ihs-text">{IHS_DARK_THEME.surface}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Glass</dt>
                  <dd className="font-mono text-ihs-text">0.02 / blur-xl</dd>
                </div>
              </dl>
            </SpotlightCard>
          </FadeUp>
        </div>
      </PageStagger>
    </AppShell>
  );
}
