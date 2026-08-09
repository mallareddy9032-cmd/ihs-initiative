'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FadeUp, PageStagger, SpotlightCard, SpringButton, springSoft } from '@/components/ui/motion';

type VaultObject = {
  id: string;
  title: string;
  mimeType: string;
  integrityHash: string;
  createdAt: string;
};

const STEPS = ['Service', 'Location', 'Confirm'] as const;

export function VaultTriageStudio() {
  const [ihsUid, setIhsUid] = useState('IHS-8802');
  const [objects, setObjects] = useState<VaultObject[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(0);
  const [serviceType, setServiceType] = useState('HOME_VISIT');
  const [sector, setSector] = useState('Ananthapur Urban');
  const [notes, setNotes] = useState('');
  const [bookingMsg, setBookingMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVault = useCallback(async () => {
    const res = await fetch(`/api/vault?ihsUid=${encodeURIComponent(ihsUid)}`);
    const data = (await res.json()) as { objects?: VaultObject[]; error?: string };
    if (!res.ok) {
      setError(data.error || 'Vault fetch failed.');
      return;
    }
    setObjects(data.objects ?? []);
    setError(null);
  }, [ihsUid]);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  const uploadPlaintext = async (title: string, plaintext: string, mimeType: string) => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch('/api/vault', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihsUid, title, plaintext, mimeType }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      await loadVault();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const text = await file.text();
    await uploadPlaintext(file.name, text, file.type || 'text/plain');
  };

  const bookTriage = async (e: FormEvent) => {
    e.preventDefault();
    setBookingMsg(null);
    setError(null);
    const res = await fetch('/api/triage/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ihsUid, serviceType, sector, notes }),
    });
    const data = (await res.json()) as {
      error?: string;
      triageCase?: { id: string; priority: string };
      dispatch?: { callsign: string | null; etaMins: number | null };
    };
    if (!res.ok) {
      setError(data.error || 'Booking failed.');
      return;
    }
    setBookingMsg(
      `Case ${data.triageCase?.id?.slice(0, 8)}… · ${data.triageCase?.priority} · ${data.dispatch?.callsign ?? 'queued'} · ETA ${data.dispatch?.etaMins ?? '—'}m`,
    );
    setStep(0);
    setNotes('');
  };

  return (
    <PageStagger className="space-y-6">
      <FadeUp>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ihs-micro text-[#4B5563]">Clinical Bio-Tech Vault</p>
            <h1 className="mt-2 font-serif text-4xl tracking-tight text-[#0F172A] md:text-5xl">
              Your care, encrypted.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4B5563]">
              Drag clinical files into the vault, then book doorstep or emergency triage through a
              fluid three-step wizard.
            </p>
          </div>
          <label className="ihs-micro">
            Patient UID
            <input
              className="ihs-input w-48"
              value={ihsUid}
              onChange={(e) => setIhsUid(e.target.value.toUpperCase())}
            />
          </label>
        </div>
      </FadeUp>

      {error ? (
        <FadeUp>
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            role="alert"
          >
            {error}
          </p>
        </FadeUp>
      ) : null}

      <div className="bento-grid">
        <FadeUp className="col-span-12 lg:col-span-7">
          <SpotlightCard className="min-h-[280px] !rounded-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="ihs-micro">Encrypted Health Vault</p>
              <span className="ihs-pill">AES · SHA-256</span>
            </div>
            <h2 className="mt-2 font-serif text-2xl text-[#0F172A]">Drop to seal</h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void onDrop(e.dataTransfer.files);
              }}
              className={`mt-5 flex min-h-[160px] flex-col items-center justify-center rounded-3xl border border-dashed px-6 text-center transition-colors ${
                dragOver
                  ? 'border-[#22C55E] bg-[#E8F5E9]'
                  : 'border-slate-300 bg-[#F4F7F4]'
              }`}
            >
              <p className="font-serif text-xl text-[#0F172A]">
                {uploading ? 'Encrypting…' : 'Drag & drop clinical files'}
              </p>
              <p className="mt-2 text-xs text-[#4B5563]">AES envelope · SHA-256 integrity</p>
              <label className="mt-4 cursor-pointer text-xs font-semibold uppercase tracking-wider text-[#143525]">
                Browse files
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => void onDrop(e.target.files)}
                />
              </label>
            </div>
            <ul className="mt-5 space-y-2">
              {objects.slice(0, 4).map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-3 py-2 text-sm transition-all duration-300 hover:-translate-y-0.5"
                >
                  <span className="truncate text-[#0F172A]">{obj.title}</span>
                  <span className="font-mono text-[10px] text-[#4B5563]">
                    {obj.integrityHash.slice(0, 10)}…
                  </span>
                </li>
              ))}
              {objects.length === 0 ? (
                <li className="text-sm text-[#4B5563]">No vault objects yet.</li>
              ) : null}
            </ul>
          </SpotlightCard>
        </FadeUp>

        <FadeUp className="col-span-12 lg:col-span-5">
          <SpotlightCard className="!rounded-3xl">
            <p className="ihs-micro">Triage Booking</p>
            <h2 className="mt-2 font-serif text-2xl text-[#0F172A]">Multi-step wizard</h2>

            <div className="relative mt-5 flex gap-2 rounded-full bg-[#F4F7F4] p-1">
              {STEPS.map((label, idx) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={`relative flex-1 rounded-full px-2 py-2 text-[11px] font-semibold uppercase tracking-wider ${
                    step === idx ? 'text-white' : 'text-[#4B5563]'
                  }`}
                >
                  {step === idx ? (
                    <motion.span
                      layoutId="triage-tab"
                      className="absolute inset-0 rounded-full bg-[#143525]"
                      transition={springSoft}
                    />
                  ) : null}
                  <span className="relative z-[1]">{label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={bookTriage} className="mt-5 space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={springSoft}
                  className="space-y-3"
                >
                  {step === 0 ? (
                    <label className="ihs-micro block">
                      Service
                      <select
                        className="ihs-input"
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                      >
                        <option value="HOME_VISIT">Home Doctor Visit</option>
                        <option value="TELECONSULT">Teleconsult</option>
                        <option value="EMERGENCY">Emergency Dispatch</option>
                        <option value="FOLLOW_UP">Follow-up</option>
                      </select>
                    </label>
                  ) : null}
                  {step === 1 ? (
                    <label className="ihs-micro block">
                      Pilot Sector
                      <select
                        className="ihs-input"
                        value={sector}
                        onChange={(e) => setSector(e.target.value)}
                      >
                        <option>Ananthapur Urban</option>
                        <option>Dharmavaram</option>
                        <option>Gooty</option>
                        <option>Puttaparthi</option>
                      </select>
                    </label>
                  ) : null}
                  {step === 2 ? (
                    <label className="ihs-micro block">
                      Notes
                      <textarea
                        rows={3}
                        className="ihs-input font-normal normal-case tracking-normal"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Symptoms, access notes…"
                      />
                    </label>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              <div className="flex gap-2">
                {step > 0 ? (
                  <SpringButton type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} className="flex-1">
                    Back
                  </SpringButton>
                ) : null}
                {step < 2 ? (
                  <SpringButton type="button" onClick={() => setStep((s) => s + 1)} className="flex-1">
                    Continue
                  </SpringButton>
                ) : (
                  <SpringButton type="submit" className="flex-1">
                    Book Triage
                  </SpringButton>
                )}
              </div>
              {bookingMsg ? (
                <p className="rounded-2xl border border-[#DCFCE7] bg-[#E8F5E9] px-3 py-2 text-xs font-semibold text-[#143525]">
                  {bookingMsg}
                </p>
              ) : null}
            </form>
          </SpotlightCard>
        </FadeUp>
      </div>
    </PageStagger>
  );
}
