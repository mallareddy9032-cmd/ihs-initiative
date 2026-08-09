'use client';

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  type HTMLMotionProps,
} from 'framer-motion';
import {
  type MouseEvent,
  type ReactNode,
  useRef,
} from 'react';

export const springSoft = { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.7 };
export const springSnappy = { type: 'spring' as const, stiffness: 520, damping: 32 };

export function PageStagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function FadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { ...springSoft, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function SpotlightCard({
  children,
  className = '',
  tone = 'light',
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode; tone?: 'light' | 'deep' }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(30);
  const background = useMotionTemplate`radial-gradient(380px circle at ${x}% ${y}%, rgba(34,197,94,0.12), transparent 45%)`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      whileHover={{ y: -4 }}
      transition={springSoft}
      className={`relative overflow-hidden ${
        tone === 'deep' ? 'ihs-card-deep' : 'ihs-card'
      } transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/10 ${className}`}
      {...props}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background }}
      />
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  );
}

export function SpringButton({
  children,
  className = '',
  variant = 'primary',
  ...props
}: HTMLMotionProps<'button'> & { variant?: 'primary' | 'ghost' | 'soft' }) {
  const base =
    variant === 'ghost'
      ? 'rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#143525] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-slate-300'
      : variant === 'soft'
        ? 'rounded-full bg-[#E8F5E9] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#143525] border border-[#DCFCE7] transition-all duration-200 hover:scale-[1.02]'
        : 'rounded-full px-6 py-3 bg-[#143525] text-white hover:bg-[#1C4B35] transition-all duration-200 hover:scale-[1.02] shadow-sm text-sm font-semibold uppercase tracking-wider';

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={springSnappy}
      className={`${base} disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function StatusPulse({
  label,
  tone = 'mint',
}: {
  label: string;
  tone?: 'mint' | 'amber' | 'red' | 'sky';
}) {
  const wrap =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : tone === 'red'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : tone === 'sky'
          ? 'bg-sky-50 text-sky-800 border-sky-200'
          : 'bg-[#E8F5E9] text-[#143525] border-[#DCFCE7]';

  const core =
    tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'red'
        ? 'bg-rose-500'
        : tone === 'sky'
          ? 'bg-sky-500'
          : 'bg-[#22C55E]';

  const ring =
    tone === 'amber'
      ? 'bg-amber-400'
      : tone === 'red'
        ? 'bg-rose-400'
        : tone === 'sky'
          ? 'bg-sky-400'
          : 'bg-emerald-400';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${wrap}`}
    >
      <span className="relative inline-flex h-2.5 w-2.5" aria-hidden>
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${ring}`}
        />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${core}`} />
      </span>
      {label}
    </span>
  );
}
