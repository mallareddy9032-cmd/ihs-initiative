/** Parse Prometheus text exposition into a flat name → number map. */
export function parsePromText(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const space = trimmed.lastIndexOf(' ');
    if (space < 0) continue;
    const metric = trimmed.slice(0, space);
    const value = Number(trimmed.slice(space + 1));
    if (!Number.isFinite(value)) continue;
    // Prefer unlabeled gauge: name without `{...}`
    const bare = metric.includes('{') ? metric.slice(0, metric.indexOf('{')) : metric;
    if (!metric.includes('{') || out[bare] === undefined) {
      out[bare] = value;
    }
    out[metric] = value;
  }
  return out;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type SlaStatus = 'healthy' | 'warn' | 'breach' | 'offline';

export function slaStatus(avgSec: number | null, engineOk: boolean): SlaStatus {
  if (!engineOk || avgSec == null) return 'offline';
  if (avgSec > 300) return 'breach';
  if (avgSec > 270) return 'warn';
  return 'healthy';
}

export interface HealthPayload {
  status?: string;
  ready?: boolean;
  dispatchers_connected?: number;
  drivers_connected?: number;
  hospitals_connected?: number;
  admins_connected?: number;
  doctors_connected?: number;
  dispatch_sla?: {
    avg_tat_seconds?: number;
    warn_threshold_seconds?: number;
    hard_threshold_seconds?: number;
  };
}

export interface MonitorSnapshot {
  avgTatSec: number | null;
  warnSec: number;
  hardSec: number;
  breachCount: number;
  processUptimeSec: number | null;
  sockets: {
    dispatchers: number;
    drivers: number;
    hospitals: number;
    admins: number;
    doctors: number;
    total: number;
  };
  engineOk: boolean;
  fetchedAt: string;
  error?: string;
}

const WARN = 270;
const HARD = 300;

export async function fetchMonitorSnapshot(): Promise<MonitorSnapshot> {
  const fetchedAt = new Date().toISOString();
  try {
    const [metricsRes, healthRes] = await Promise.all([
      fetch('/metrics', { cache: 'no-store' }),
      fetch('/healthz', { cache: 'no-store' }),
    ]);

    if (!metricsRes.ok && !healthRes.ok) {
      return emptyOffline(fetchedAt, `Engine unreachable (${metricsRes.status}/${healthRes.status})`);
    }

    let avgTatSec: number | null = null;
    let warnSec = WARN;
    let hardSec = HARD;
    let breachCount = 0;
    let processUptimeSec: number | null = null;

    if (metricsRes.ok) {
      const prom = parsePromText(await metricsRes.text());
      avgTatSec = prom.ihs_dispatch_avg_tat_seconds ?? null;
      warnSec = prom.ihs_dispatch_sla_warn_threshold_seconds ?? WARN;
      hardSec = prom.ihs_dispatch_sla_hard_threshold_seconds ?? HARD;
      breachCount = prom.ihs_dispatch_sla_warn_breaches_total ?? 0;
      processUptimeSec = prom.ihs_process_start_time_seconds
        ? Date.now() / 1000 - prom.ihs_process_start_time_seconds
        : prom.process_start_time_seconds
          ? Date.now() / 1000 - prom.process_start_time_seconds
          : null;
    }

    let sockets = {
      dispatchers: 0,
      drivers: 0,
      hospitals: 0,
      admins: 0,
      doctors: 0,
      total: 0,
    };
    let engineOk = metricsRes.ok || healthRes.ok;

    if (healthRes.ok) {
      const health = (await healthRes.json()) as HealthPayload;
      engineOk = health.ready !== false && health.status !== 'degraded';
      if (health.dispatch_sla?.avg_tat_seconds != null && avgTatSec == null) {
        avgTatSec = health.dispatch_sla.avg_tat_seconds;
      }
      warnSec = health.dispatch_sla?.warn_threshold_seconds ?? warnSec;
      hardSec = health.dispatch_sla?.hard_threshold_seconds ?? hardSec;
      sockets = {
        dispatchers: health.dispatchers_connected ?? 0,
        drivers: health.drivers_connected ?? 0,
        hospitals: health.hospitals_connected ?? 0,
        admins: health.admins_connected ?? 0,
        doctors: health.doctors_connected ?? 0,
        total: 0,
      };
      sockets.total =
        sockets.dispatchers +
        sockets.drivers +
        sockets.hospitals +
        sockets.admins +
        sockets.doctors;
    }

    return {
      avgTatSec,
      warnSec,
      hardSec,
      breachCount,
      processUptimeSec,
      sockets,
      engineOk,
      fetchedAt,
    };
  } catch (err) {
    return emptyOffline(fetchedAt, err instanceof Error ? err.message : 'Fetch failed');
  }
}

function emptyOffline(fetchedAt: string, error: string): MonitorSnapshot {
  return {
    avgTatSec: null,
    warnSec: WARN,
    hardSec: HARD,
    breachCount: 0,
    processUptimeSec: null,
    sockets: { dispatchers: 0, drivers: 0, hospitals: 0, admins: 0, doctors: 0, total: 0 },
    engineOk: false,
    fetchedAt,
    error,
  };
}
