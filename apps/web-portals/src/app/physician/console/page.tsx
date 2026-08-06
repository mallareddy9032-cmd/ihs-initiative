// ============================================================================
// FILE: src/app/physician/console/page.tsx
// CONTEXT: Physician Console - Split-view acuity + Rx pad
// ============================================================================

'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EcgLiveCanvas } from '@/components/clinical/EcgLiveCanvas';
import { StockAwareRxPad } from '@/components/clinical/StockAwareRxPad';

function PhysicianConsoleInner() {
  const searchParams = useSearchParams();
  const caseId = searchParams.get('case') || searchParams.get('caseId') || '';
  const fleetId = searchParams.get('fleet') || searchParams.get('fleetId') || 'FLEET-UNASSIGNED';
  const [caseInput, setCaseInput] = useState(caseId);

  const activeCaseId = useMemo(() => caseId || caseInput.trim(), [caseId, caseInput]);

  return (
    <div className="console-layout grid grid-cols-1 lg:grid-cols-2 min-h-screen w-full bg-[#F2F2F7] text-[#1C1C1E]">
      <section className="left-panel border-r border-black/5 p-4 space-y-4 bg-white/60">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="bg-[#007AFF] inline-block text-white font-black px-3 py-1 rounded-xl text-xs tracking-wider mb-2">
              PHYSICIAN CONSOLE
            </div>
            <h1 className="text-xl font-bold">Live Acuity Stream</h1>
          </div>
          {!caseId && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Case UUID"
                className="bg-white border border-black/5 rounded-2xl px-3 py-2 text-sm font-mono"
                value={caseInput}
                onChange={(e) => setCaseInput(e.target.value)}
              />
            </div>
          )}
        </header>

        {!activeCaseId ? (
          <div
            role="status"
            className="flex h-64 items-center justify-center border border-dashed border-black/10 rounded-3xl text-[#8E8E93] font-mono text-sm bg-white"
          >
            Waiting for case context… open with ?case=&lt;uuid&gt;
          </div>
        ) : (
          <>
            <div className="text-xs font-mono text-[#8E8E93]">CASE: {activeCaseId}</div>
            <EcgLiveCanvas caseId={activeCaseId} />
            <div className="rounded-3xl border border-black/5 bg-white p-4 text-sm text-[#8E8E93] shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              WebRTC video / stethoscope audio panes mount here in subsequent sprints. ECG canvas
              above is the Phase 2 telemetry critical path.
            </div>
          </>
        )}
      </section>

      <section className="right-panel p-4 overflow-y-auto space-y-4">
        <h2 className="text-xl font-bold">Clinical Action</h2>
        <p className="text-sm text-[#8E8E93]">
          Fleet inventory is FEFO-gated. Authorization applies a SHA-256 WORM lock.
        </p>

        {!activeCaseId ? (
          <div
            role="status"
            className="rounded-3xl border border-black/5 bg-white p-6 text-[#8E8E93] text-sm shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
          >
            Rx pad locked until a case ID is provided.
          </div>
        ) : (
          <StockAwareRxPad caseId={activeCaseId} fleetId={fleetId} />
        )}
      </section>
    </div>
  );
}

export default function PhysicianConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F2F2F7] text-[#1C1C1E] font-mono">
          Loading physician console…
        </div>
      }
    >
      <PhysicianConsoleInner />
    </Suspense>
  );
}
