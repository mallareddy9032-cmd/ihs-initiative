'use client';

import type { ReactNode } from 'react';
import { StatusPulse } from '@/components/ui/motion';

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="ambient-spot min-h-screen">
      <header className="relative z-[1] border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-ihs-info px-2.5 py-1 text-xs font-black tracking-[0.18em] text-white shadow-[0_0_24px_rgba(37,99,235,0.35)]">
              CLINICAL
            </div>
            <div>
              <p className="font-serif text-2xl text-ihs-text">{title}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ihs-muted">
                {subtitle}
              </p>
            </div>
          </div>
          <StatusPulse label="Triage Desk Live" tone="sky" />
        </div>
      </header>
      <main className="relative z-[1] mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
