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

const fieldClass =
  'mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-ihs-text outline-none transition-colors focus:border-sky-400/50';

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
    <div className="ambient-spot min-h-screen pb-28 text-ihs-text">
      <header className="relative z-[1] border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
              Charting · Focus Mode
            </p>
            <h1 className="font-serif text-3xl text-ihs-text md:text-4xl">SOAP & E-Rx</h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusPulse label="Encounter Open" tone="sky" />
            <Link href="/">
              <SpringButton className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-ihs-muted hover:border-white/20 hover:text-ihs-text">
                Workspace
              </SpringButton>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-[1] mx-auto w-full max-w-5xl px-6 py-8">
        <PageStagger className="grid gap-6 lg:grid-cols-2">
          <FadeUp>
            <form onSubmit={onSubmit} id="soap-form" className="space-y-4">
              <SpotlightCard className="space-y-4 p-6">
                <h2 className="font-serif text-2xl">New Encounter</h2>
                {error ? (
                  <p
                    className="rounded-xl border border-ihs-danger/40 bg-ihs-danger/15 px-3 py-2 text-sm text-rose-200"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Clinician UID
                    <input
                      className={fieldClass}
                      value={clinicianUid}
                      onChange={(e) => setClinicianUid(e.target.value.toUpperCase())}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Patient UID
                    <input
                      className={fieldClass}
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
                  <label
                    key={label}
                    className="block text-xs font-bold uppercase tracking-wider text-ihs-muted"
                  >
                    {label}
                    <textarea
                      required
                      rows={3}
                      className={fieldClass}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </label>
                ))}
              </SpotlightCard>

              <SpotlightCard className="p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-300">
                  E-Prescription
                </p>
                <h3 className="mt-1 font-serif text-xl text-ihs-text">Rx Card</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Drug
                    <input
                      className={fieldClass}
                      value={drugName}
                      onChange={(e) => setDrugName(e.target.value)}
                      placeholder="Amoxicillin"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Dosage
                    <input
                      className={fieldClass}
                      value={dosage}
                      onChange={(e) => setDosage(e.target.value)}
                      placeholder="500mg"
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
                    Duration
                    <input
                      className={fieldClass}
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
            <SpotlightCard className="p-6">
              <h2 className="font-serif text-2xl">Recent Charts</h2>
              <ul className="mt-4 space-y-3">
                {charts.map((chart, i) => (
                  <motion.li
                    key={chart.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springSoft, delay: i * 0.05 }}
                    className="rounded-xl border border-white/10 bg-black/35 px-4 py-3 transition-colors hover:border-white/20"
                  >
                    <p className="font-mono text-xs text-ihs-mint">{chart.id.slice(0, 8)}…</p>
                    <p className="mt-1 text-sm text-ihs-text">
                      <span className="text-ihs-muted">S:</span> {chart.subjective}
                    </p>
                    <p className="text-sm text-ihs-text">
                      <span className="text-ihs-muted">A:</span> {chart.assessment}
                    </p>
                    {chart.prescriptions[0] ? (
                      <div className="mt-3 rounded-lg border border-amber-300/25 bg-amber-500/10 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                          Prescription
                        </p>
                        <p className="mt-1 text-xs text-amber-100">
                          {chart.prescriptions[0].drugName} · {chart.prescriptions[0].dosage} ·{' '}
                          {chart.prescriptions[0].duration}
                        </p>
                      </div>
                    ) : null}
                  </motion.li>
                ))}
                {charts.length === 0 ? (
                  <li className="text-sm text-ihs-muted">No charts yet for this clinician.</li>
                ) : null}
              </ul>
            </SpotlightCard>
          </FadeUp>
        </PageStagger>
      </main>

      {/* Floating action dock */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={springSoft}
        className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
      >
        <div className="flex items-center gap-2 rounded-2xl border border-white/15 bg-neutral-900/70 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          <span className="hidden px-2 font-mono text-[10px] uppercase tracking-wider text-ihs-muted sm:inline">
            {patientIhsUid}
          </span>
          <Link href="/">
            <SpringButton
              type="button"
              className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold uppercase tracking-wider text-ihs-muted"
            >
              Queue
            </SpringButton>
          </Link>
          <SpringButton
            type="submit"
            form="soap-form"
            disabled={saving}
            className="rounded-xl bg-ihs-olive px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-glow disabled:opacity-60"
          >
            {saving ? 'Writing…' : 'Save SOAP + E-Rx'}
          </SpringButton>
        </div>
      </motion.div>
    </div>
  );
}
