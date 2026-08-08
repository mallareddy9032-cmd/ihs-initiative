import { IHS_DARK_THEME } from '@ihs/types';
import { AppShell } from '@/components/AppShell';

export default function PatientPortalHomePage() {
  return (
    <AppShell title="Patient Portal" subtitle="Self-Service · Encrypted Health Vault">
      <section className="grid gap-6 md:grid-cols-2">
        <article className="glass-panel rounded-2xl p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-ihs-mint">Phase 2 Surface</p>
          <h1 className="mt-2 font-serif text-3xl text-ihs-text">Your Family Health Vault</h1>
          <p className="mt-3 text-sm leading-relaxed text-ihs-muted">
            Authenticated patients manage SOS preferences, doorstep care requests, and AES-256
            encrypted clinical history through this consolidated portal.
          </p>
          <dl className="mt-6 grid gap-3 text-sm">
            <div className="flex justify-between border-b border-ihs-border pb-2">
              <dt className="text-ihs-muted">Canvas token</dt>
              <dd className="font-mono text-ihs-text">{IHS_DARK_THEME.canvas}</dd>
            </div>
            <div className="flex justify-between border-b border-ihs-border pb-2">
              <dt className="text-ihs-muted">Primary accent</dt>
              <dd className="font-mono text-ihs-olive">{IHS_DARK_THEME.olive}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ihs-muted">Shared packages</dt>
              <dd className="text-ihs-text">@ihs/types · @ihs/auth-client · @ihs/db</dd>
            </div>
          </dl>
        </article>

        <article className="glass-panel rounded-2xl p-6">
          <h2 className="font-serif text-2xl text-ihs-text">Phase 4 APIs</h2>
          <ul className="mt-4 space-y-3 text-sm text-ihs-muted">
            <li className="rounded-xl border border-ihs-border bg-ihs-elevated/60 px-4 py-3">
              <code className="text-ihs-mint">GET/POST /api/vault</code> — encrypted vault objects
            </li>
            <li className="rounded-xl border border-ihs-border bg-ihs-elevated/60 px-4 py-3">
              <code className="text-ihs-mint">POST /api/triage/book</code> — create TriageCase + dispatch
            </li>
            <li className="rounded-xl border border-ihs-border bg-ihs-elevated/60 px-4 py-3">
              Backed by shared <code className="text-ihs-mint">@ihs/db</code> mock / Prisma plane
            </li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
