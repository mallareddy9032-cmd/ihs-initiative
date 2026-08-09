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

type TenantLicense = {
  planTier: string;
  status: string;
  slaSeconds: number;
  fleetSeats: number;
  doctorLicenses: number;
  renewalDays: number | null;
  currentPeriodEnd: string | null;
};

export default function SuperAdminMasterControlPlanePage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [keys, setKeys] = useState<CryptoKeyRecord[]>([]);
  const [ledger, setLedger] = useState<AuditLedgerEntry[]>([]);
  const [license, setLicense] = useState<TenantLicense | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [auditQuery, setAuditQuery] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const [flagsRes, keysRes, auditRes, billingRes] = await Promise.all([
        fetch('/api/super/flags'),
        fetch('/api/super/keys'),
        fetch('/api/super/audit'),
        fetch('/api/billing/status?userId=SUPER-001'),
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
      if (billingRes.ok) {
        const billingJson = (await billingRes.json()) as { license: TenantLicense };
        setLicense(billingJson.license);
      }
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
    <div className="ihs-shell text-[#0F172A]">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="ihs-micro">Privileged Control · AAL3</p>
            <h1 className="font-serif text-3xl tracking-tight md:text-4xl">
              Super Admin Control Plane
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Scope <code className="text-[#143525]">superadmin:tenant:write</code> · sealed session
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/">
              <SpringButton variant="ghost">Ops Hub</SpringButton>
            </Link>
            {license ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#143525]/30 bg-[#E8F5E9] px-3 py-1 text-xs font-semibold text-[#143525]">
                <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                {license.planTier.replaceAll('_', ' ')} · SLA {license.slaSeconds}s
              </span>
            ) : null}
            <StatusPulse label="Privileged Session" tone="red" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-8">
        {state === 'loading' ? (
          <p className="text-sm text-[#4B5563]">Loading sealed control-plane datasets…</p>
        ) : null}

        {state === 'error' && error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700" role="alert">
            {error}
          </div>
        ) : null}

        {state === 'ready' ? (
          <PageStagger className="space-y-6">
            {license ? (
              <FadeUp>
                <SpotlightCard className="!rounded-3xl">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="ihs-micro">Tenant license</p>
                      <h2 className="mt-1 font-serif text-2xl text-[#0F172A]">
                        Enterprise SLA tier · {license.planTier.replaceAll('_', ' ')}
                      </h2>
                      <p className="mt-1 text-sm text-[#4B5563]">
                        Status {license.status} · Sub-{license.slaSeconds}s dispatch SLA ·{' '}
                        {license.fleetSeats} fleet unit seats · {license.doctorLicenses} doctor
                        licenses
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-right">
                      <p className="ihs-micro">Renewal countdown</p>
                      <p className="font-serif text-3xl text-[#143525]">
                        {license.renewalDays ?? '—'}
                        <span className="ml-1 text-base text-[#4B5563]">days</span>
                      </p>
                      <p className="text-xs text-[#4B5563]">
                        {license.currentPeriodEnd
                          ? new Date(license.currentPeriodEnd).toLocaleDateString()
                          : 'No period end'}
                      </p>
                    </div>
                  </div>
                </SpotlightCard>
              </FadeUp>
            ) : null}

            <FadeUp>
              <div className="grid gap-3 sm:grid-cols-3">
                <SpotlightCard tone="deep" className="!py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    Flags Live
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">
                    {flags.filter((f) => f.enabled).length}
                  </p>
                </SpotlightCard>
                <SpotlightCard tone="deep" className="!py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    Keys Active
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">
                    {keys.filter((k) => k.status === 'active').length}
                  </p>
                </SpotlightCard>
                <SpotlightCard tone="deep" className="!py-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">
                    Ledger Rows
                  </p>
                  <p className="mt-2 font-serif text-3xl text-[#22C55E]">{ledger.length}</p>
                </SpotlightCard>
              </div>
            </FadeUp>

            <FadeUp>
              <SpotlightCard>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="ihs-micro">Tenant Control</p>
                    <h2 className="font-serif text-2xl">Global Feature Flags</h2>
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
                      className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#0F172A]">{flag.label}</p>
                          <p className="mt-1 font-mono text-[11px] text-[#4B5563]">{flag.id}</p>
                          <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
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
                              ? 'border-[#143525]/50 bg-[#143525]'
                              : 'border-slate-200 bg-slate-100'
                          }`}
                        >
                          <motion.span
                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                            animate={{ left: flag.enabled ? 24 : 2 }}
                            transition={springSoft}
                          />
                        </button>
                      </div>
                      <span
                        className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          flag.risk === 'high'
                            ? 'bg-rose-50 text-rose-700'
                            : flag.risk === 'medium'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-[#E8F5E9] text-[#143525]'
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
              <SpotlightCard>
                <p className="ihs-micro">Key Ceremony</p>
                <h2 className="mt-1 font-serif text-2xl">Cryptographic Key Rotation</h2>
                <p className="mt-2 max-w-2xl text-sm text-[#4B5563]">
                  Metadata-only view. Raw key material never leaves the HSM / Cloud Engine secret
                  store.
                </p>
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-[#4B5563]">
                        <th className="px-3 py-2 font-semibold">Key ID</th>
                        <th className="px-3 py-2 font-semibold">Purpose</th>
                        <th className="px-3 py-2 font-semibold">Alg</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Fingerprint</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <tr key={key.kid} className="border-b border-slate-100 hover:bg-[#F4F7F4]/60">
                          <td className="px-3 py-3 font-mono text-xs text-[#143525]">{key.kid}</td>
                          <td className="px-3 py-3 text-[#0F172A]">{key.purpose}</td>
                          <td className="px-3 py-3 font-mono text-xs text-[#4B5563]">
                            {key.algorithm}
                          </td>
                          <td className="px-3 py-3">
                            <span className="ihs-pill">
                              {key.status === 'active' || key.status === 'rotating' ? (
                                <span className="relative inline-flex h-2 w-2">
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22C55E]" />
                                </span>
                              ) : null}
                              {key.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-xs text-[#4B5563]">
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
              <SpotlightCard>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="ihs-micro">WORM Chain</p>
                    <h2 className="font-serif text-2xl">Audit Ledger Explorer</h2>
                  </div>
                  <label className="ihs-micro block">
                    Filter
                    <input
                      type="search"
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      placeholder="Actor, action, resource…"
                      className="ihs-input w-64"
                    />
                  </label>
                </div>
                <ul className="space-y-2">
                  {filteredLedger.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs text-[#143525]">{entry.id}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              entry.outcome === 'ALLOW'
                                ? 'bg-[#E8F5E9] text-[#143525]'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {entry.outcome}
                          </span>
                        </div>
                        <time className="font-mono text-[11px] text-[#4B5563]" dateTime={entry.at}>
                          {new Date(entry.at).toLocaleString()}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-[#0F172A]">
                        <span className="font-semibold">{entry.actor}</span>
                        <span className="text-[#4B5563]"> · </span>
                        <span className="font-mono text-xs text-[#143525]">{entry.action}</span>
                        <span className="text-[#4B5563]"> → </span>
                        <span className="text-[#4B5563]">{entry.resource}</span>
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[#4B5563]">hash {entry.hash}</p>
                    </li>
                  ))}
                  {filteredLedger.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-[#4B5563]">
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
