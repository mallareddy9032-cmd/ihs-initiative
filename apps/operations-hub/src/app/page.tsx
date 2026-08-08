import Link from 'next/link';
import { APP_ROLE_POLICY, IHS_DARK_THEME } from '@ihs/types';
import { AppShell } from '@/components/AppShell';
import { DispatchTelemetryPanel } from '@/components/DispatchTelemetryPanel';

export default function OperationsHubHomePage() {
  return (
    <AppShell title="Operations Hub" subtitle="ERP · Dispatch · Super Admin">
      <section className="grid gap-6 lg:grid-cols-3">
        <article className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">Phase 2 Surface</p>
          <h1 className="mt-2 font-serif text-3xl text-ihs-text">Command & Control Plane</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ihs-muted">
            Dispatchers and system admins run the Ananthapuramu GIS HUD, fleet ERP compliance, SLA
            telemetry, and regional super-admin controls from this hub.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-ihs-border bg-ihs-elevated/70 px-4 py-5 text-center text-sm font-semibold text-ihs-mint">
              Dispatch GIS
            </div>
            <div className="rounded-xl border border-ihs-border bg-ihs-elevated/70 px-4 py-5 text-center text-sm font-semibold text-amber-300">
              Fleet ERP
            </div>
            <Link
              href="/admin/super"
              className="ios-press rounded-xl border border-ihs-danger/40 bg-ihs-danger/10 px-4 py-5 text-center text-sm font-semibold text-rose-300 hover:bg-ihs-danger/20"
            >
              Super Admin →
            </Link>
          </div>
        </article>

        <aside className="glass-panel rounded-2xl p-6">
          <h2 className="font-serif text-xl text-ihs-text">Role Gate</h2>
          <ul className="mt-4 space-y-2">
            {APP_ROLE_POLICY.operationsHub.map((role) => (
              <li
                key={role}
                className="rounded-lg border border-ihs-warning/30 bg-ihs-warning/10 px-3 py-2 font-mono text-sm text-amber-200"
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
              <dt>Danger</dt>
              <dd className="font-mono text-ihs-danger">{IHS_DARK_THEME.danger}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <div className="mt-6">
        <DispatchTelemetryPanel />
      </div>
    </AppShell>
  );
}
