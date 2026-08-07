// ============================================================================
// FILE: src/components/ui/TopNav.tsx
// CONTEXT: Granola-style Command Center header with live KPIs
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export const TopNav: React.FC<{
  operatorName?: string;
  activeCases?: number;
  mobilizedUnits?: number;
  avgTatLabel?: string;
  connectionLabel?: string;
  activePath?: string;
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
}> = ({
  operatorName = 'Dispatcher Desk #04',
  activeCases = 0,
  mobilizedUnits = 0,
  avgTatLabel = '03:42 mins',
  connectionLabel,
  activePath,
  audioEnabled = true,
  onToggleAudio,
}) => {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const linkClass = (path: string) =>
    `text-xs font-bold tracking-wide px-2.5 py-1 rounded-full border spring-press ios-press ${
      activePath === path
        ? 'bg-[#0D5C4D] border-[#0D5C4D] text-white'
        : 'border-transparent text-[#6B6B70] hover:text-[#1C1C1E] hover:bg-black/[0.04]'
    }`;

  return (
    <nav className="mx-3 mt-3 mb-2 glass-panel rounded-[22px] px-4 sm:px-5 py-3 flex flex-wrap justify-between items-center text-[#1C1C1E] gap-3 sticky top-3 z-40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-[#0D5C4D] text-white font-black px-3 py-1.5 rounded-full text-sm tracking-wider shrink-0 ios-press">
          IHS COMMAND
        </div>
        <div className="min-w-0">
          <div className="font-serif text-lg leading-tight text-[#1C1C1E]">Dispatch Command</div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0D5C4D] tracking-wide">
            <span className="led-dot bg-[#0D5C4D] glow-green" />
            24/7 GIS HUD · ANANTHAPUR 50KM PILOT GRID
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-1 border-l border-black/5 pl-3 ml-1">
          <Link href="/dispatcher/dashboard" className={linkClass('/dispatcher/dashboard')}>
            LIVE OPS
          </Link>
          <Link href="/dispatcher/analytics" className={linkClass('/dispatcher/analytics')}>
            ANALYTICS
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center">
        <div className="cmd-card px-3 py-1.5 min-w-[96px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#6B6B70]">Active</div>
          <div className="font-mono-ops text-sm font-bold text-[#DC2626]">
            {activeCases} Critical
          </div>
        </div>
        <div className="cmd-card px-3 py-1.5 min-w-[96px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#6B6B70]">Fleet</div>
          <div className="font-mono-ops text-sm font-bold text-[#0D5C4D]">
            {mobilizedUnits} Units
          </div>
        </div>
        <div className="cmd-card px-3 py-1.5 min-w-[104px]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#6B6B70]">Avg TAT</div>
          <div className="font-mono-ops text-sm font-bold text-[#D97706]">{avgTatLabel}</div>
        </div>
        {connectionLabel && (
          <div className="hidden md:block text-[10px] font-mono-ops text-[#6B6B70] border-l border-black/5 pl-3">
            {connectionLabel}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleAudio}
          className="ios-press rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-bold text-[#1C1C1E]"
          aria-pressed={audioEnabled}
        >
          {audioEnabled ? '🔊 Active' : '🔇 Muted'}
        </button>
        <div className="text-right">
          <div className="text-xs font-bold text-[#0D5C4D]">{operatorName}</div>
          <div className="font-mono-ops text-[11px] text-[#6B6B70] tabular-nums">{clock}</div>
        </div>
      </div>
    </nav>
  );
};
