'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { AuditLedgerEntry, CryptoKeyRecord, FeatureFlag } from '@/lib/super-admin-data';
import {
  FadeUp,
  PageStagger,
  SpotlightCard,
  SpringButton,
  StatusPulse,
  springSoft,
} from '@/components/ui/motion';

type LoadState = 'loading' | 'ready' | 'error';

export default function SuperAdminMasterControlPlanePage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [keys, setKeys] = useState<CryptoKeyRecord[]>([]);
  const [ledger, setLedger] = useState<AuditLedgerEntry[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [flagsRes, keysRes, auditRes] = await Promise.all([
        fetch('/api/super/flags'),
        fetch('/api/super/keys'),
        fetch('/api/super/audit'),
      ]);

      if (flagsRes.status === 403 || keysRes.status === 403 || auditRes.status === 403) {
        const payload = (await flagsRes.json().catch(() => null)) as { reason?: string } | null;
        if (payload?.reason === 'STEP_UP_REQUIRED' || payload?.reason === 'MISSING_SCOPE') {
          window.location.href = `/auth/step-up?callbackUrl=${encodeURIComponent('/admin/super')}&reason=${payload.reason === 'MISSING_SCOPE' ? 'scope' : 'aal3'}`;
          return;
        }
        throw new Error('Super Admin access denied. SYSTEM_ADMIN + AAL3 required.');
      }

      if (!flagsRes.ok || !keysRes.ok || !auditRes.ok) {
        throw new Error('Failed to load Super Admin control-plane datasets.');
      }

      const flagsJson = (await flagsRes.json()) as { flags: FeatureFlag[] };
      const keysJson = (await keysRes.json()) as { keys: CryptoKeyRecord[] };
      const auditJson = (await auditRes.json()) as { ledger: AuditLedgerEntry[] };
      setFlags(flagsJson.flags);
      setKeys(keysJson.keys);
      setLedger(auditJson.ledger);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Control plane load failed.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.id === id ? { ...flag, enabled: !flag.enabled } : flag)),
    );
  };

  const filteredLedger = ledger.filter((entry) => {
    if (!auditQuery.trim()) return true;
    const q = auditQuery.toLowerCase();
    return (
      entry.id.toLowerCase().includes(q) ||
      entry.actor.toLowerCase().includes(q) ||
      entry.action.toLowerCase().includes(q) ||
      entry.resource.toLowerCase().includes(q)
    );
  });

  return (
    <div className="ambient-spot min-h-screen text-ihs-text">
      <header className="relative z-[1] border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ihs-mint">
              Privileged HUD · AAL3
            </p>
            <h1 className="font-serif text-3xl tracking-tight text-ihs-text md:text-4xl">
              Super Admin Control Plane
            </h1>
            <p className="mt-1 text-sm text-ihs-muted">
              Scope <code className="text-ihs-mint">superadmin:tenant:write</code> · sealed session
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/">
              <SpringButton className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-ihs-muted hover:border-white/20 hover:text-ihs-text">
                Ops Hub
              </SpringButton>
            </Link>
            <StatusPulse label="Privileged Session" tone="red" />
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
        {state === 'loading' ? (
          <p className="text-sm text-ihs-muted">Loading sealed control-plane datasets…</p>
        ) : null}

        {state === 'error' && error ? (
          <div
            className="glass-card rounded-2xl border border-ihs-danger/40 px-5 py-4 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {state === 'ready' ? (
          <PageStagger className="space-y-6">
            <FadeUp>
              <div className="grid gap-3 sm:grid-cols-3">
                <SpotlightCard className="px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    Flags Live
                  </p>
                  <p className="mt-2 font-serif text-3xl text-ihs-mint">
                    {flags.filter((f) => f.enabled).length}
                  </p>
                </SpotlightCard>
                <SpotlightCard className="px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    Keys Active
                  </p>
                  <p className="mt-2 font-serif text-3xl text-sky-300">
                    {keys.filter((k) => k.status === 'active').length}
                  </p>
                </SpotlightCard>
                <SpotlightCard className="px-4 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ihs-muted">
                    Ledger Rows
                  </p>
                  <p className="mt-2 font-serif text-3xl text-amber-300">{ledger.length}</p>
                </SpotlightCard>
              </div>
            </FadeUp>

            <FadeUp>
              <SpotlightCard className="p-6">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
                      Tenant Control
                    </p>
                    <h2 className="font-serif text-2xl text-ihs-text">Global Feature Flags</h2>
                  </div>
                  <StatusPulse
                    label={`${flags.filter((f) => f.enabled).length} active`}
                    tone="amber"
                  />
                </div>
                <ul className="grid gap-3 md:grid-cols-2">
                  {flags.map((flag, i) => (
                    <motion.li
                      key={flag.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springSoft, delay: i * 0.04 }}
                      className="rounded-xl border border-white/10 bg-black/35 px-4 py-4 transition-colors hover:border-white/20"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ihs-text">{flag.label}</p>
                          <p className="mt-1 font-mono text-[11px] text-ihs-muted">{flag.id}</p>
                          <p className="mt-2 text-sm leading-relaxed text-ihs-muted">
                            {flag.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={flag.enabled}
                          onClick={() => toggleFlag(flag.id)}
                          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
                            flag.enabled
                              ? 'border-ihs-mint/50 bg-ihs-olive shadow-glow'
                              : 'border-white/10 bg-black/40'
                          }`}
                        >
                          <motion.span
                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
                            animate={{ left: flag.enabled ? 24 : 2 }}
                            transition={springSoft}
                          />
                        </button>
                      </div>
                      <span
                        className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          flag.risk === 'high'
                            ? 'bg-ihs-danger/20 text-rose-300'
                            : flag.risk === 'medium'
                              ? 'bg-ihs-warning/20 text-amber-300'
                              : 'bg-ihs-olive/20 text-ihs-mint'
                        }`}
                      >
                        {flag.risk} risk
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </SpotlightCard>
            </FadeUp>

            <FadeUp>
              <SpotlightCard className="p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-300">
                  Key Ceremony
                </p>
                <h2 className="mt-1 font-serif text-2xl text-ihs-text">Cryptographic Key Rotation</h2>
                <p className="mt-2 max-w-2xl text-sm text-ihs-muted">
                  Metadata-only view. Raw key material never leaves the HSM / Cloud Engine secret
                  store.
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-ihs-muted">
                        <th className="px-3 py-2 font-bold">Key ID</th>
                        <th className="px-3 py-2 font-bold">Purpose</th>
                        <th className="px-3 py-2 font-bold">Alg</th>
                        <th className="px-3 py-2 font-bold">Status</th>
                        <th className="px-3 py-2 font-bold">Fingerprint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <tr
                          key={key.kid}
                          className="border-b border-white/5 transition-colors hover:bg-white/[0.02]"
                        >
                          <td className="px-3 py-3 font-mono text-xs text-ihs-mint">{key.kid}</td>
                          <td className="px-3 py-3 text-ihs-text">{key.purpose}</td>
                          <td className="px-3 py-3 font-mono text-xs text-ihs-muted">
                            {key.algorithm}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                key.status === 'active'
                                  ? 'bg-ihs-olive/20 text-ihs-mint'
                                  : key.status === 'rotating'
                                    ? 'bg-ihs-warning/20 text-amber-300'
                                    : 'bg-white/5 text-ihs-muted'
                              }`}
                            >
                              {key.status === 'active' || key.status === 'rotating' ? (
                                <span
                                  className={`status-breathe h-1.5 w-1.5 rounded-full ${
                                    key.status === 'active' ? 'bg-ihs-mint' : 'bg-amber-300'
                                  }`}
                                  aria-hidden
                                />
                              ) : null}
                              {key.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-ihs-muted">
                            {key.fingerprint}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SpotlightCard>
            </FadeUp>

            <FadeUp>
              <SpotlightCard className="p-6">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-300">
                      WORM Chain
                    </p>
                    <h2 className="font-serif text-2xl text-ihs-text">Audit Ledger Explorer</h2>
                  </div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Filter
                    <input
                      type="search"
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      placeholder="Actor, action, resource…"
                      className="mt-2 w-64 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ihs-text outline-none focus:border-ihs-mint"
                    />
                  </label>
                </div>
                <ul className="space-y-2">
                  {filteredLedger.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition-colors hover:border-white/20"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-ihs-mint">{entry.id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              entry.outcome === 'ALLOW'
                                ? 'bg-ihs-olive/20 text-ihs-mint'
                                : 'bg-ihs-danger/20 text-rose-300'
                            }`}
                          >
                            {entry.outcome}
                          </span>
                        </div>
                        <time className="font-mono text-[11px] text-ihs-muted" dateTime={entry.at}>
                          {new Date(entry.at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-ihs-text">
                        <span className="font-semibold">{entry.actor}</span>
                        <span className="text-ihs-muted"> · </span>
                        <span className="font-mono text-xs text-sky-300">{entry.action}</span>
                        <span className="text-ihs-muted"> → </span>
                        <span className="text-ihs-muted">{entry.resource}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-ihs-muted">hash {entry.hash}</p>
                    </li>
                  ))}
                  {filteredLedger.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-ihs-muted">
                      No ledger rows match this filter.
                    </li>
                  ) : null}
                </ul>
              </SpotlightCard>
            </FadeUp>
          </PageStagger>
        ) : null}
      </main>
    </div>
  );
}
