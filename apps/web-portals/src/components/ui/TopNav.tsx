// ============================================================================
// FILE: src/components/ui/TopNav.tsx
// CONTEXT: Next.js - macOS Sequoia Light command header
// ============================================================================

'use client';

import React from 'react';
import Link from 'next/link';

export const TopNav: React.FC<{
  operatorName: string;
  activeCases: number;
  connectionLabel?: string;
  activePath?: string;
}> = ({ operatorName, activeCases, connectionLabel, activePath }) => {
  const linkClass = (path: string) =>
    `text-xs font-bold tracking-wide px-2.5 py-1 rounded-full border spring-press ios-press ${
      activePath === path
        ? 'bg-[#007AFF] border-[#007AFF] text-white'
        : 'border-transparent text-[#8E8E93] hover:text-[#1C1C1E] hover:bg-black/[0.04]'
    }`;

  const wsLive =
    !connectionLabel ||
    /live|open|connected|ws live/i.test(connectionLabel);

  return (
    <nav className="mx-3 mt-3 mb-1 glass-panel ios-capsule px-4 sm:px-6 py-3 flex justify-between items-center text-[#1C1C1E] gap-3 sticky top-3 z-40">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="bg-[#FF2D55] text-white font-black px-3 py-1.5 rounded-full text-sm tracking-wider shrink-0 ios-press">
          IHS COMMAND
        </div>
        <div className="hidden sm:flex items-center gap-1 border-l border-black/5 pl-4">
          <Link href="/dispatcher/dashboard" className={linkClass('/dispatcher/dashboard')}>
            LIVE OPS
          </Link>
          <Link href="/dispatcher/analytics" className={linkClass('/dispatcher/analytics')}>
            ANALYTICS
          </Link>
        </div>
        <span className="hidden md:inline text-[#8E8E93] text-xs font-mono border-l border-black/5 pl-4 tabular-nums">
          Node: AP-SOUTH-2
        </span>
        {connectionLabel && (
          <span className="hidden lg:inline-flex items-center gap-2 text-xs font-mono text-[#8E8E93] border-l border-black/5 pl-4">
            <span
              className={`led-dot ${wsLive ? 'bg-[#34C759] glow-green' : 'bg-[#FF9500] glow-amber'}`}
            />
            <span className="tabular-nums text-[#1C1C1E]">{connectionLabel}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <div className="sm:hidden flex gap-1">
          <Link href="/dispatcher/dashboard" className={linkClass('/dispatcher/dashboard')}>
            OPS
          </Link>
          <Link href="/dispatcher/analytics" className={linkClass('/dispatcher/analytics')}>
            STATS
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {activeCases > 0 && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF2D55] opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 led-dot ${
                activeCases > 0 ? 'bg-[#FF2D55] glow-red' : 'bg-[#34C759] glow-green'
              }`}
            />
          </span>
          <span className="text-sm font-bold text-[#1C1C1E] tabular-nums">
            {activeCases} ACTIVE
          </span>
        </div>

        <div className="text-sm text-[#007AFF] font-bold border-l border-black/5 pl-4 sm:pl-6">
          {operatorName}
        </div>
      </div>
    </nav>
  );
};
