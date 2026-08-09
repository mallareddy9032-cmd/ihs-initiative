'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { FadeUp, PageStagger, SpotlightCard, SpringButton, StatusPulse } from '@/components/ui/motion';

type ClinicalBilling = {
  subscription: {
    planTier: string;
    status: string;
    doctorLicenses: number;
    erxMonthlyQuota: number;
    currentPeriodEnd: string | null;
  } | null;
  meters: { erxUsed: number; erxQuota: number; aiSoapEnabled: boolean };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    taxAmount: number;
    currency: string;
    status: string;
    pdfUrl: string | null;
    createdAt: string;
  }>;
};

export default function ClinicalSubscriptionPage() {
  const [data, setData] = useState<ClinicalBilling | null>(null);
  const [aiSoap, setAiSoap] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/billing/status?userId=DOC-101', { cache: 'no-store' });
    const json = (await res.json()) as ClinicalBilling;
    setData(json);
    setAiSoap(Boolean(json.meters?.aiSoapEnabled));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const erxPct = data
    ? Math.min(100, Math.round((data.meters.erxUsed / Math.max(1, data.meters.erxQuota)) * 100))
    : 0;

  const renewClinical = async () => {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'DOC-101', interval: 'monthly' }),
    });
    const json = (await res.json()) as { error?: string; message?: string; checkout?: { mock?: boolean } };
    if (!res.ok) {
      setMsg(json.error || 'Checkout failed.');
      return;
    }
    setMsg(json.checkout?.mock ? 'Clinical Pro mock subscription refreshed.' : 'Checkout ready.');
    await load();
  };

  return (
    <AppShell title="Subscription" subtitle="Doctor licenses · e-Rx meters · Billing history">
      <PageStagger className="space-y-6">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="ihs-micro">Clinical billing</p>
              <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#0F172A]">
                Practice license
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <StatusPulse label={data?.subscription?.status ?? '…'} tone="sky" />
              <Link href="/clinical/chart">
                <SpringButton variant="ghost">SOAP Chart</SpringButton>
              </Link>
            </div>
          </div>
        </FadeUp>

        <div className="bento-grid">
          <FadeUp className="col-span-12 lg:col-span-7">
            <SpotlightCard className="!rounded-3xl space-y-4">
              <p className="ihs-micro">Active doctor licenses</p>
              <h2 className="font-serif text-3xl text-[#0F172A]">
                {data?.subscription?.doctorLicenses ?? 0}{' '}
                <span className="text-lg text-[#4B5563]">seat(s)</span>
              </h2>
              <p className="text-sm text-[#4B5563]">
                Plan {data?.subscription?.planTier?.replaceAll('_', ' ') ?? '—'} · renews{' '}
                {data?.subscription?.currentPeriodEnd
                  ? new Date(data.subscription.currentPeriodEnd).toLocaleDateString()
                  : '—'}
              </p>

              <div>
                <div className="mb-2 flex justify-between text-xs font-semibold text-[#4B5563]">
                  <span>Monthly e-Rx quota</span>
                  <span>
                    {data?.meters.erxUsed ?? 0} / {data?.meters.erxQuota ?? 500}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#E8F5E9]">
                  <div
                    className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
                    style={{ width: `${erxPct}%` }}
                  />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-[#0F172A]">AI SOAP Assistant</span>
                  <span className="mt-0.5 block text-xs text-[#4B5563]">Clinical Pro add-on</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiSoap}
                  onClick={() => setAiSoap((v) => !v)}
                  className={`relative h-7 w-12 rounded-full ${aiSoap ? 'bg-[#143525]' : 'bg-slate-200'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      aiSoap ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </label>

              <SpringButton type="button" onClick={() => void renewClinical()}>
                Renew / Checkout Clinical Pro
              </SpringButton>
              {msg ? <p className="text-xs font-semibold text-[#143525]">{msg}</p> : null}
            </SpotlightCard>
          </FadeUp>

          <FadeUp className="col-span-12 lg:col-span-5">
            <SpotlightCard className="!rounded-3xl">
              <p className="ihs-micro">Billing history</p>
              <h2 className="mt-1 font-serif text-2xl">Invoices</h2>
              <ul className="mt-4 space-y-2">
                {(data?.invoices ?? []).map((inv) => (
                  <li key={inv.id} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-xs text-[#143525]">{inv.invoiceNumber}</span>
                      <span className="ihs-pill">{inv.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#4B5563]">
                      ₹{inv.amount + inv.taxAmount} · {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
                {data && data.invoices.length === 0 ? (
                  <li className="text-sm text-[#4B5563]">No invoices yet for this clinician.</li>
                ) : null}
              </ul>
            </SpotlightCard>
          </FadeUp>
        </div>
      </PageStagger>
    </AppShell>
  );
}
