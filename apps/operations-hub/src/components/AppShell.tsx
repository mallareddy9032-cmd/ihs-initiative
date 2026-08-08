import type { ReactNode } from 'react';

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
    <div className="min-h-screen">
      <header className="border-b border-ihs-border bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-ihs-danger px-2.5 py-1 text-xs font-black tracking-widest text-white">
              OPS
            </div>
            <div>
              <p className="font-serif text-xl text-ihs-text">{title}</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-ihs-muted">
                {subtitle}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-ihs-warning/40 bg-ihs-warning/15 px-3 py-1 text-xs font-bold text-amber-300">
            <span className="h-2 w-2 rounded-full bg-ihs-warning" aria-hidden="true" />
            Command Grid Active
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
