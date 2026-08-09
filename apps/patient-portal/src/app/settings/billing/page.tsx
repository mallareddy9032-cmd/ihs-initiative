'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { RazorpayCheckoutButton } from '@/components/RazorpayCheckoutButton';
import { FadeUp, PageStagger, SpotlightCard, SpringButton, StatusPulse } from '@/components/ui/motion';

type BillingStatus = {
  subscription: {
    planTier: string;
    status: string;
    familySeats: number;
    vaultGb: number;
    currentPeriodEnd: string | null;
  } | null;
  vault: { usedGb: number; capGb: number; usedBytes: number; capBytes: number };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    taxAmount: number;
    currency: string;
    hsnSacCode: string;
    gstin: string | null;
    status: string;
    pdfUrl: string | null;
    createdAt: string;
  }>;
};

export default function PatientBillingSettingsPage() {
  const [data, setData] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/billing/status?userId=IHS-8802', { cache: 'no-store' });
    const json = (await res.json()) as BillingStatus & { error?: string };
    if (!res.ok) {
      setError(json.error || 'Failed to load billing status.');
      return;
    }
    setData(json);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const usedPct = data
    ? Math.min(100, Math.round((data.vault.usedBytes / Math.max(1, data.vault.capBytes)) * 100))
    : 0;

  return (
    <AppShell title="Billing" subtitle="Subscription · Vault quota · GST invoices">
      <PageStagger className="space-y-6">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ihs-micro">Patient billing</p>
              <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#0F172A]">
                Plan & entitlements
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <StatusPulse
                label={data?.subscription ? `${data.subscription.status}` : 'loading'}
              />
              <Link href="/">
                <SpringButton variant="ghost">Vault Home</SpringButton>
              </Link>
            </div>
          </div>
        </FadeUp>

        {error ? (
          <FadeUp>
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          </FadeUp>
        ) : null}

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-7">
            <SpotlightCard className="!rounded-3xl space-y-4">
              <p className="ihs-micro">Active plan</p>
              <h2 className="font-serif text-2xl text-[#0F172A]">
                {data?.subscription?.planTier?.replaceAll('_', ' ') ?? '—'}
              </h2>
              <p className="text-sm text-[#4B5563]">
                Family seats: {data?.subscription?.familySeats ?? '—'} · Renews{' '}
                {data?.subscription?.currentPeriodEnd
                  ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString()
                  : '—'}
              </p>

              <div>
                <div className="mb-2 flex justify-between text-xs font-semibold text-[#4B5563]">
                  <span>Vault quota</span>
                  <span>
                    {data?.vault.usedGb.toFixed(1) ?? '0.0'} / {data?.vault.capGb.toFixed(1) ?? '5.0'}{' '}
                    GB Used
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#E8F5E9]">
                  <div
                    className="h-full rounded-full bg-[#143525] transition-all duration-500"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>

              {data?.subscription?.planTier !== 'PATIENT_SHIELD' ? (
                <RazorpayCheckoutButton
                  planTier="PATIENT_SHIELD"
                  label="Upgrade to Shield"
                  onComplete={() => void load()}
                />
              ) : (
                <span className="ihs-pill">Shield active</span>
              )}
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-5">
            <SpotlightCard className="!rounded-3xl">
              <p className="ihs-micro">GST tax invoices</p>
              <h2 className="mt-1 font-serif text-2xl">Download history</h2>
              <ul className="mt-4 space-y-2">
                {(data?.invoices ?? []).map((inv) => (
                  <li
                    key={inv.id}
                    className="rounded-2xl border border-slate-200/80 bg-white px-3 py-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-[#143525]">{inv.invoiceNumber}</span>
                      <span className="ihs-pill">{inv.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#4B5563]">
                      ₹{inv.amount + inv.taxAmount} · base ₹{inv.amount} + GST ₹{inv.taxAmount} · HSN{' '}
                      {inv.hsnSacCode}
                    </p>
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        className="mt-2 inline-block text-xs font-semibold text-[#143525] underline-offset-2 hover:underline"
                      >
                        Download GST invoice
                      </a>
                    ) : null}
                  </li>
                ))}
                {data && data.invoices.length === 0 ? (
                  <li className="text-sm text-[#4B5563]">No invoices yet.</li>
                ) : null}
              </ul>
            </SpotlightCard>
          </FadeUp>
        </div>
      </PageStagger>
    </AppShell>
  );
}
