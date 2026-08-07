'use client';

import React, { useMemo, useState } from 'react';

export type MlcScreenAnswer = 'yes' | 'no' | null;

export interface MlcScreeningResult {
  blocked: boolean;
  answers: {
    poisoningAssaultSuicide: MlcScreenAnswer;
    unconsciousAccident: MlcScreenAnswer;
  };
}

interface MlcScreeningGateProps {
  patientLabel?: string;
  onCleared: () => void;
  onStatutoryRedirect: (result: {
    script: string;
    dial108: string;
    dial112: string;
  }) => void;
}

const SCRIPT =
  'Sir/Madam, based on your symptoms, we are required by law to transfer this call to the State 108 Emergency Service. Please stay on the line, I am patching you through now.';

/**
 * Pre-dispatch MLC matrix (PRD P1-2.1).
 * YES on either question hard-locks IHS fleet and surfaces immediate 108/112 patch.
 */
export function MlcScreeningGate({
  patientLabel,
  onCleared,
  onStatutoryRedirect,
}: MlcScreeningGateProps) {
  const [q1, setQ1] = useState<MlcScreenAnswer>(null);
  const [q2, setQ2] = useState<MlcScreenAnswer>(null);

  const triggered = q1 === 'yes' || q2 === 'yes';
  const cleared = q1 === 'no' && q2 === 'no';

  const statusLine = useMemo(() => {
    if (triggered) return 'MLC PROTOCOL TRIGGERED — fleet dispatch locked';
    if (cleared) return 'Screening cleared — IHS ALS dispatch permitted';
    return 'Complete both questions before mobilizing';
  }, [triggered, cleared]);

  return (
    <div className="rounded-2xl border border-[#DC2626]/25 bg-[#FEF2F2] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#DC2626]">
            Pre-dispatch MLC gate
          </p>
          <h3 className="font-serif text-lg text-[#1C1C1E] mt-0.5">Medico-Legal Screening</h3>
          {patientLabel ? (
            <p className="text-xs text-[#6B6B70] mt-0.5">{patientLabel}</p>
          ) : null}
        </div>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${
            triggered
              ? 'bg-[#DC2626] text-white'
              : cleared
                ? 'bg-[#0D5C4D] text-white'
                : 'bg-black/5 text-[#6B6B70]'
          }`}
        >
          {triggered ? 'LOCKED' : cleared ? 'CLEARED' : 'PENDING'}
        </span>
      </div>

      <div className="mt-3 space-y-3">
        <QuestionRow
          label="Is this related to poisoning, assault, or suicide?"
          value={q1}
          onChange={setQ1}
        />
        <QuestionRow
          label="Is the patient unconscious due to an accident?"
          value={q2}
          onChange={setQ2}
        />
      </div>

      <p className="mt-3 text-xs text-[#6B6B70]">{statusLine}</p>

      {triggered ? (
        <div className="mt-3 rounded-xl bg-white/80 border border-[#DC2626]/20 p-3">
          <p className="text-sm text-[#1C1C1E] leading-relaxed">{SCRIPT}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="tel:108"
              className="inline-flex items-center justify-center rounded-xl bg-[#DC2626] text-white text-sm font-bold px-4 py-2.5 hover:bg-[#b91c1c] transition"
              onClick={() =>
                onStatutoryRedirect({ script: SCRIPT, dial108: '108', dial112: '112' })
              }
            >
              Transfer Call to 108
            </a>
            <a
              href="tel:112"
              className="inline-flex items-center justify-center rounded-xl border border-[#DC2626] text-[#DC2626] text-sm font-bold px-4 py-2.5 hover:bg-[#DC2626]/5 transition"
              onClick={() =>
                onStatutoryRedirect({ script: SCRIPT, dial108: '108', dial112: '112' })
              }
            >
              Transfer Call to 112
            </a>
          </div>
        </div>
      ) : null}

      {cleared ? (
        <button
          type="button"
          onClick={onCleared}
          className="mt-3 w-full rounded-xl bg-[#0D5C4D] text-white text-sm font-bold py-2.5 hover:bg-[#0a4a3e] transition"
        >
          Proceed to IHS fleet board
        </button>
      ) : null}
    </div>
  );
}

function QuestionRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MlcScreenAnswer;
  onChange: (v: MlcScreenAnswer) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-[#1C1C1E] mb-1.5">{label}</p>
      <div className="flex gap-2">
        {(['yes', 'no'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold border transition ${
              value === opt
                ? opt === 'yes'
                  ? 'bg-[#DC2626] border-[#DC2626] text-white'
                  : 'bg-[#0D5C4D] border-[#0D5C4D] text-white'
                : 'bg-white border-black/10 text-[#1C1C1E] hover:border-black/25'
            }`}
          >
            {opt.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
