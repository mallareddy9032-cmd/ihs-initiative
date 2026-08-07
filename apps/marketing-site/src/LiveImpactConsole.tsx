import { useEffect, useRef, useState } from 'react';

type MetricFormat = 'minutes' | 'percent' | 'thousands' | 'negPercent';

interface ImpactMetric {
  id: string;
  label: string;
  /** Numeric target used by the counter */
  target: number;
  format: MetricFormat;
  subtext: string;
  /** Sparkline y-values 0–1 (ascending growth) */
  spark: number[];
}

const METRICS: ImpactMetric[] = [
  {
    id: 'response',
    label: 'Response Time',
    target: 5,
    format: 'minutes',
    subtext: 'Avg. response vs 45m legacy norm.',
    spark: [0.92, 0.88, 0.7, 0.55, 0.42, 0.3, 0.22, 0.18, 0.14, 0.12],
  },
  {
    id: 'sla',
    label: 'SLA Compliance',
    target: 99.8,
    format: 'percent',
    subtext: 'Operational uptime across 20 nodes.',
    spark: [0.55, 0.58, 0.62, 0.68, 0.74, 0.8, 0.86, 0.9, 0.94, 0.98],
  },
  {
    id: 'consults',
    label: 'Consultations',
    target: 12,
    format: 'thousands',
    subtext: 'Live patient/doctor syncs.',
    spark: [0.2, 0.28, 0.35, 0.42, 0.5, 0.58, 0.66, 0.75, 0.85, 0.95],
  },
  {
    id: 'cost',
    label: 'Cost Efficiency',
    target: 65,
    format: 'negPercent',
    subtext: 'Reduced logistics & ER overhead.',
    spark: [0.15, 0.25, 0.32, 0.4, 0.5, 0.58, 0.68, 0.78, 0.88, 0.96],
  },
];

function formatMetric(value: number, format: MetricFormat): string {
  switch (format) {
    case 'minutes': {
      const m = Math.max(0, Math.round(value));
      return `< ${String(m).padStart(2, '0')}m`;
    }
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'thousands':
      return `${Math.round(value)}k+`;
    case 'negPercent':
      return `-${Math.round(value)}%`;
    default:
      return String(value);
  }
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useInViewOnce<T extends HTMLElement>(rootMargin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0.25 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

function useCountUp(target: number, active: boolean, durationMs = 1600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, target, durationMs]);

  return value;
}

function Sparkline({
  id,
  points,
  invert,
}: {
  id: string;
  points: number[];
  invert?: boolean;
}) {
  const w = 120;
  const h = 36;
  const pad = 2;
  const vals = invert ? points.map((p) => 1 - p) : points;
  const step = (w - pad * 2) / Math.max(1, vals.length - 1);
  const coords = vals.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - v) * (h - pad * 2);
    return `${x},${y}`;
  });
  const line = coords.join(' ');
  const first = coords[0] ?? `${pad},${h - pad}`;
  const area = `M ${first} L ${coords.slice(1).join(' ')} L ${w - pad},${h - pad} L ${pad},${h - pad} Z`;
  const fillId = `impactSparkFill-${id}`;

  return (
    <svg className="impact-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(13, 92, 77, 0.45)" />
          <stop offset="100%" stopColor="rgba(13, 92, 77, 0)" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <polyline
        points={line}
        fill="none"
        stroke="#3DDC97"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({ metric, active }: { metric: ImpactMetric; active: boolean }) {
  const value = useCountUp(metric.target, active);
  const display = formatMetric(value, metric.format);

  return (
    <article className="impact-card">
      <p className="impact-label">{metric.label}</p>
      <p className="impact-value" aria-live="polite">
        {display}
      </p>
      <p className="impact-sub">{metric.subtext}</p>
      <Sparkline
        id={metric.id}
        points={metric.spark}
        invert={metric.format === 'minutes'}
      />
    </article>
  );
}

export function LiveImpactConsole() {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();

  return (
    <div className="impact-console" ref={ref}>
      <div className="impact-console-bar">
        <span className="impact-live-dot" />
        <span>LIVE IMPACT CONSOLE · ANANTHAPURAMU PILOT</span>
      </div>
      <div className="impact-grid">
        {METRICS.map((metric) => (
          <MetricCard key={metric.id} metric={metric} active={inView} />
        ))}
      </div>
    </div>
  );
}
