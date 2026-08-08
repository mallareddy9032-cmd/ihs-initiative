import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_DARK_THEME } from '@ihs/types';
import { AppShell } from '@/components/AppShell';

export default function ClinicalWorkspaceHomePage() {
  return (
    <AppShell title="Clinical Workspace" subtitle="Consultation · Triage · E-Rx">
      <section className="grid gap-6 lg:grid-cols-3">
        <article className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300">Phase 2 Surface</p>
          <h1 className="mt-2 font-serif text-3xl text-ihs-text">Doctor Consultation Hub</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ihs-muted">
            Physicians authenticate with UID/PIN, pull the triage queue, open encrypted vaults, and
            issue stock-aware e-prescriptions from one consolidated workspace.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-ihs-border bg-ihs-elevated/70 px-4 py-5 text-center text-sm font-semibold text-ihs-text">
              Triage Queue
            </div>
            <div className="rounded-xl border border-ihs-border bg-ihs-elevated/70 px-4 py-5 text-center text-sm font-semibold text-ihs-text">
              Live Consult
            </div>
            <Link
              href="/clinical/chart"
              className="ios-press rounded-xl border border-ihs-info/40 bg-ihs-info/10 px-4 py-5 text-center text-sm font-semibold text-sky-300 hover:bg-ihs-info/20"
            >
              SOAP Chart →
            </Link>
          </div>
        </article>

        <aside className="glass-panel rounded-2xl p-6">
          <h2 className="font-serif text-xl text-ihs-text">Access Policy</h2>
          <p className="mt-2 text-xs uppercase tracking-wider text-ihs-muted">Allowed roles</p>
          <ul className="mt-3 space-y-2">
            {APP_ROLE_POLICY.clinicalWorkspace.map((role) => (
              <li
                key={role}
                className="rounded-lg border border-ihs-info/30 bg-ihs-info/10 px-3 py-2 font-mono text-sm text-sky-200"
              >
                {role}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-ihs-muted">
            Theme surface <span className="font-mono text-ihs-text">{IHS_DARK_THEME.surface}</span>
          </p>
        </aside>
      </section>
    </AppShell>
  );
}
