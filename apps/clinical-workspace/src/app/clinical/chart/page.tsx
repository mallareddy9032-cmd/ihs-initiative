'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FadeUp,
  PageStagger,
  SpotlightCard,
  SpringButton,
  StatusPulse,
  springSoft,
} from '@/components/ui/motion';

type ChartRow = {
  id: string;
  clinicianUid: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  createdAt: string;
  prescriptions: Array<{
    id: string;
    drugName: string;
    dosage: string;
    duration: string;
  }>;
};

export default function ClinicalChartPage() {
  const [clinicianUid, setClinicianUid] = useState('DOC-101');
  const [patientIhsUid, setPatientIhsUid] = useState('IHS-8802');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [duration, setDuration] = useState('');
  const [charts, setCharts] = useState<ChartRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/clinical/chart?clinicianUid=${encodeURIComponent(clinicianUid)}`);
    const data = (await res.json()) as { charts?: ChartRow[]; error?: string };
    if (!res.ok) {
      setError(data.error || 'Failed to load charts.');
      return;
    }
    setCharts(data.charts ?? []);
  }, [clinicianUid]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const prescriptions =
        drugName && dosage && duration
          ? [{ drugName, dosage, duration, instructions: 'Take as directed' }]
          : [];
      const res = await fetch('/api/clinical/chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientIhsUid,
          clinicianUid,
          subjective,
          objective,
          assessment,
          plan,
          prescriptions,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Chart write failed.');
      setSubjective('');
      setObjective('');
      setAssessment('');
      setPlan('');
      setDrugName('');
      setDosage('');
      setDuration('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chart write failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ihs-shell pb-28 text-[#0F172A]">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="ihs-micro">Charting · Focus Mode</p>
            <h1 className="font-serif text-3xl tracking-tight md:text-4xl">SOAP & E-Rx</h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusPulse label="Encounter Open" tone="sky" />
            <Link href="/">
              <SpringButton variant="ghost">Workspace</SpringButton>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <PageStagger className="grid gap-6 lg:grid-cols-2">
          <FadeUp>
            <form onSubmit={onSubmit} id="soap-form" className="space-y-4">
              <SpotlightCard className="!rounded-3xl space-y-4">
                <h2 className="font-serif text-2xl">New Encounter</h2>
                {error ? (
                  <p
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="ihs-micro block">
                    Clinician UID
                    <input
                      className="ihs-input"
                      value={clinicianUid}
                      onChange={(e) => setClinicianUid(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="ihs-micro block">
                    Patient UID
                    <input
                      className="ihs-input"
                      value={patientIhsUid}
                      onChange={(e) => setPatientIhsUid(e.target.value.toUpperCase())}
                    />
                  </label>
                </div>
                {(
                  [
                    ['Subjective', subjective, setSubjective],
                    ['Objective', objective, setObjective],
                    ['Assessment', assessment, setAssessment],
                    ['Plan', plan, setPlan],
                  ] as const
                ).map(([label, value, setter]) => (
                  <label key={label} className="ihs-micro block">
                    {label}
                    <textarea
                      required
                      rows={3}
                      className="ihs-input font-normal normal-case tracking-normal"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </label>
                ))}
              </SpotlightCard>

              <SpotlightCard className="!rounded-3xl">
                <p className="ihs-micro">E-Prescription</p>
                <h3 className="mt-1 font-serif text-xl">Rx Card</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="ihs-micro block">
                    Drug
                    <input
                      className="ihs-input"
                      value={drugName}
                      onChange={(e) => setDrugName(e.target.value)}
                      placeholder="Amoxicillin"
                    />
                  </label>
                  <label className="ihs-micro block">
                    Dosage
                    <input
                      className="ihs-input"
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="500mg"
                    />
                  </label>
                  <label className="ihs-micro block">
                    Duration
                    <input
                      className="ihs-input"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="5 days"
                    />
                  </label>
                </div>
              </SpotlightCard>
            </form>
          </FadeUp>

          <FadeUp>
            <SpotlightCard className="!rounded-3xl">
              <h2 className="font-serif text-2xl">Recent Charts</h2>
              <ul className="mt-4 space-y-3">
                {charts.map((chart, i) => (
                  <motion.li
                    key={chart.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springSoft, delay: i * 0.05 }}
                    className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10"
                  >
                    <p className="font-mono text-xs text-[#143525]">{chart.id.slice(0, 8)}…</p>
                    <p className="mt-1 text-sm text-[#0F172A]">
                      <span className="text-[#4B5563]">S:</span> {chart.subjective}
                    </p>
                    <p className="text-sm text-[#0F172A]">
                      <span className="text-[#4B5563]">A:</span> {chart.assessment}
                    </p>
                    {chart.prescriptions[0] ? (
                      <div className="mt-3 rounded-2xl border border-[#DCFCE7] bg-[#E8F5E9] px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#143525]">
                          Prescription
                        </p>
                        <p className="mt-1 text-xs text-[#0F172A]">
                          {chart.prescriptions[0].drugName} · {chart.prescriptions[0].dosage} ·{' '}
                          {chart.prescriptions[0].duration}
                        </p>
                      </div>
                    ) : null}
                  </motion.li>
                ))}
                {charts.length === 0 ? (
                  <li className="text-sm text-[#4B5563]">No charts yet for this clinician.</li>
                ) : null}
              </ul>
            </SpotlightCard>
          </FadeUp>
        </PageStagger>
      </main>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springSoft}
        className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
      >
        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-2 shadow-lg shadow-emerald-950/10 backdrop-blur-md">
          <span className="hidden px-2 font-mono text-[10px] uppercase tracking-wider text-[#4B5563] sm:inline">
            {patientIhsUid}
          </span>
          <Link href="/">
            <SpringButton type="button" variant="ghost" className="!px-4 !py-2">
              Queue
            </SpringButton>
          </Link>
          <SpringButton
            type="submit"
            form="soap-form"
            disabled={saving}
            className="!px-5 !py-2.5"
          >
            {saving ? 'Writing…' : 'Save SOAP + E-Rx'}
          </SpringButton>
        </div>
      </motion.div>
    </div>
  );
}
