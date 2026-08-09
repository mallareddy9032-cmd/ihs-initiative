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
    <div className="ihs-shell">
      <header className="ihs-nav sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[#0D281E] px-3 py-1 text-xs font-bold tracking-[0.16em] text-white">
              OPS
            </div>
            <div>
              <p className="font-serif text-2xl tracking-tight text-[#0F172A]">{title}</p>
              <p className="ihs-micro">{subtitle}</p>
            </div>
          </div>
          <StatusPulse label="Command Grid Active" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
