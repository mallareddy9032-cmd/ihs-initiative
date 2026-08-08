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
        hidden: { opacity: 0, y: 18 },
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
  ...props
}: HTMLMotionProps<'div'> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const x = useMotionValue(50);
  const y = useMotionValue(30);
  const background = useMotionTemplate`radial-gradient(420px circle at ${x}% ${y}%, rgba(61,220,151,0.14), transparent 42%)`;

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
      whileHover={{ y: -2 }}
      transition={springSoft}
      className={`glass-card overflow-hidden rounded-2xl ${className}`}
      {...props}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{ background }}
      />
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  );
}

export function SpringButton({
  children,
  className = '',
  ...props
}: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={springSnappy}
      className={className}
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
  const toneClass =
    tone === 'amber'
      ? 'border-ihs-warning/40 bg-ihs-warning/10 text-amber-300'
      : tone === 'red'
        ? 'border-ihs-danger/40 bg-ihs-danger/10 text-rose-300'
        : tone === 'sky'
          ? 'border-sky-400/40 bg-sky-400/10 text-sky-300'
          : 'border-ihs-olive/40 bg-ihs-olive/15 text-ihs-mint';
  const dotClass =
    tone === 'amber'
      ? 'bg-ihs-warning'
      : tone === 'red'
        ? 'bg-ihs-danger'
        : tone === 'sky'
          ? 'bg-sky-400'
          : 'bg-ihs-mint';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${toneClass}`}
    >
      <span className={`status-breathe h-2 w-2 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}
