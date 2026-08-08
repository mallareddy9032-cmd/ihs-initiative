'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

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
    <div className="min-h-screen bg-[#020617] text-ihs-text">
      <header className="border-b border-ihs-border bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-300">
              Phase 4 · Clinical Data Plane
            </p>
            <h1 className="font-serif text-3xl text-ihs-text md:text-4xl">SOAP Chart & E-Rx</h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-ihs-border px-4 py-2 text-xs font-bold uppercase tracking-wider text-ihs-muted hover:text-ihs-text"
          >
            Workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-8 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="glass-panel space-y-4 rounded-2xl p-6">
          <h2 className="font-serif text-2xl">New Encounter</h2>
          {error ? (
            <p className="rounded-lg border border-ihs-danger/40 bg-ihs-danger/15 px-3 py-2 text-sm text-rose-200" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
              Clinician UID
              <input
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm text-ihs-text"
                value={clinicianUid}
                onChange={(e) => setClinicianUid(e.target.value.toUpperCase())}
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
              Patient UID
              <input
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm text-ihs-text"
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
            <label key={label} className="block text-xs font-bold uppercase tracking-wider text-ihs-muted">
              {label}
              <textarea
                required
                rows={3}
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm font-normal normal-case tracking-normal text-ihs-text"
                value={value}
                onChange={(e) => setter(e.target.value)}
              />
            </label>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
              Drug
              <input
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm text-ihs-text"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
                placeholder="Amoxicillin"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
              Dosage
              <input
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm text-ihs-text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="500mg"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-ihs-muted">
              Duration
              <input
                className="mt-2 w-full rounded-xl border border-ihs-border bg-ihs-elevated px-3 py-2 text-sm text-ihs-text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="5 days"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="ios-press w-full rounded-xl bg-ihs-olive px-4 py-3 text-sm font-bold uppercase tracking-widest text-white disabled:opacity-60"
          >
            {saving ? 'Writing chart…' : 'Save SOAP + E-Rx'}
          </button>
        </form>

        <section className="glass-panel rounded-2xl p-6">
          <h2 className="font-serif text-2xl">Recent Charts</h2>
          <ul className="mt-4 space-y-3">
            {charts.map((chart) => (
              <li key={chart.id} className="rounded-xl border border-ihs-border bg-black/30 px-4 py-3">
                <p className="font-mono text-xs text-ihs-mint">{chart.id.slice(0, 8)}…</p>
                <p className="mt-1 text-sm text-ihs-text">
                  <span className="text-ihs-muted">S:</span> {chart.subjective}
                </p>
                <p className="text-sm text-ihs-text">
                  <span className="text-ihs-muted">A:</span> {chart.assessment}
                </p>
                {chart.prescriptions[0] ? (
                  <p className="mt-2 text-xs text-amber-300">
                    Rx {chart.prescriptions[0].drugName} · {chart.prescriptions[0].dosage} ·{' '}
                    {chart.prescriptions[0].duration}
                  </p>
                ) : null}
              </li>
            ))}
            {charts.length === 0 ? (
              <li className="text-sm text-ihs-muted">No charts yet for this clinician.</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
