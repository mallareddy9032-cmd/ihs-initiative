// ============================================================================
// FILE: src/infrastructure/metrics/DispatchSlaMetrics.ts
// CONTEXT: Prometheus metrics for Sub-5-Min dispatch SLA (alert threshold 04:30)
// ============================================================================

import client from 'prom-client';

/** Early-warning threshold before hard 05:00 Sub-5-Min SLA */
export const DISPATCH_SLA_WARN_SECONDS = 270; // 04:30
export const DISPATCH_SLA_HARD_SECONDS = 300; // 05:00

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'ihs_' });

const tatHistogram = new client.Histogram({
  name: 'ihs_dispatch_tat_seconds',
  help: 'End-to-end dispatch response time in seconds (panic/initiate → on-scene or modeled TAT)',
  labelNames: ['source'] as const,
  buckets: [30, 60, 90, 120, 180, 240, 270, 300, 360, 420, 600],
  registers: [register],
});

const avgGauge = new client.Gauge({
  name: 'ihs_dispatch_avg_tat_seconds',
  help: 'Rolling average dispatch TAT in seconds (Sub-5-Min SLA). Alert when > 270 (04:30).',
  registers: [register],
});

const warnThresholdGauge = new client.Gauge({
  name: 'ihs_dispatch_sla_warn_threshold_seconds',
  help: 'Configured early-warning SLA threshold in seconds (04:30 = 270)',
  registers: [register],
});

const hardThresholdGauge = new client.Gauge({
  name: 'ihs_dispatch_sla_hard_threshold_seconds',
  help: 'Configured hard Sub-5-Min SLA threshold in seconds (05:00 = 300)',
  registers: [register],
});

const breachCounter = new client.Counter({
  name: 'ihs_dispatch_sla_warn_breaches_total',
  help: 'Count of observed TAT samples that exceeded the 04:30 early-warning threshold',
  registers: [register],
});

const ROLLING_MAX = 40;
const rollingSeconds: number[] = [];

warnThresholdGauge.set(DISPATCH_SLA_WARN_SECONDS);
hardThresholdGauge.set(DISPATCH_SLA_HARD_SECONDS);

function refreshAvg(): void {
  if (!rollingSeconds.length) {
    avgGauge.set(0);
    return;
  }
  const sum = rollingSeconds.reduce((a, b) => a + b, 0);
  avgGauge.set(Math.round((sum / rollingSeconds.length) * 10) / 10);
}

export class DispatchSlaMetrics {
  static register(): client.Registry {
    return register;
  }

  /** Observe a dispatch TAT sample (seconds) and update rolling average gauge. */
  static observeTatSeconds(seconds: number, source: string = 'live'): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    const clamped = Math.min(seconds, 3600);
    tatHistogram.observe({ source }, clamped);
    rollingSeconds.push(clamped);
    if (rollingSeconds.length > ROLLING_MAX) rollingSeconds.shift();
    refreshAvg();
    if (clamped > DISPATCH_SLA_WARN_SECONDS) {
      breachCounter.inc();
    }
  }

  /** Sync from ExecutiveAnalytics avg TAT (minutes). */
  static syncAvgFromMinutes(avgTatMin: number): void {
    if (!Number.isFinite(avgTatMin) || avgTatMin < 0) return;
    const seconds = avgTatMin * 60;
    avgGauge.set(Math.round(seconds * 10) / 10);
  }

  /** Seed rolling window from minute samples (demo / executive analytics). */
  static seedFromMinuteSamples(samplesMin: number[]): void {
    for (const m of samplesMin) {
      if (!Number.isFinite(m) || m < 0) continue;
      DispatchSlaMetrics.observeTatSeconds(m * 60, 'analytics');
    }
  }

  static async metricsText(): Promise<string> {
    return register.metrics();
  }

  static contentType(): string {
    return register.contentType;
  }

  static currentAvgSeconds(): number {
    if (!rollingSeconds.length) return 0;
    return rollingSeconds.reduce((a, b) => a + b, 0) / rollingSeconds.length;
  }
}
