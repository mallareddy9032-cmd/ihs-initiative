import { useEffect, useState } from 'react';
import {
  fetchMonitorSnapshot,
  formatDuration,
  formatUptime,
  slaStatus,
  type MonitorSnapshot,
  type SlaStatus,
} from './metrics';

const POLL_MS = 5000;

const STATUS_COPY: Record<SlaStatus, { label: string; hint: string }> = {
  healthy: { label: 'Within SLA', hint: 'Average TAT under 04:30 early-warning line' },
  warn: { label: 'Early warning', hint: 'Average TAT above 04:30 — investigate before 05:00' },
  breach: { label: 'Hard breach', hint: 'Average TAT above 05:00 Sub-5-Min hard SLA' },
  offline: { label: 'Engine offline', hint: 'Cloud engine :8080 not reachable' },
};

export default function App() {
  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await fetchMonitorSnapshot();
      if (!cancelled) setSnap(next);
    };
    void load();
    const id = window.setInterval(() => {
      void load();
      setTick((t) => t + 1);
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const status = slaStatus(snap?.avgTatSec ?? null, snap?.engineOk ?? false);
  const meta = STATUS_COPY[status];
  const avg = snap?.avgTatSec ?? null;
  const warn = snap?.warnSec ?? 270;
  const hard = snap?.hardSec ?? 300;
  const pct = avg == null ? 0 : Math.min(100, (avg / hard) * 100);

  return (
    <div className="shell">
      <header className="top">
        <div className="brand-block">
          <p className="eyebrow">IHS · Ananthapuramu Pilot</p>
          <h1>IHS Sub-5-Min Dispatch SLA</h1>
          <p className="subtitle">Real-Time Health Monitor</p>
        </div>
        <div className={`pulse-pill status-${status}`}>
          <span className="dot" aria-hidden />
          {meta.label}
        </div>
      </header>

      <section className="hero-metric" aria-live="polite">
        <div className="hero-copy">
          <p className="metric-label">Average dispatch TAT</p>
          <p className="metric-value">{avg == null ? '—' : formatDuration(avg)}</p>
          <p className="metric-sub">
            {avg == null ? 'Awaiting metrics' : `${avg.toFixed(1)}s`} · Target &lt; {formatDuration(warn)}{' '}
            ({warn}s / 4.5m)
          </p>
          <p className="hint">{meta.hint}</p>
        </div>
        <div className="gauge-wrap" role="img" aria-label={`SLA gauge ${pct.toFixed(0)} percent of hard limit`}>
          <div className="gauge-track">
            <div
              className={`gauge-fill status-${status}`}
              style={{ width: `${pct}%` }}
            />
            <div className="gauge-mark warn" style={{ left: `${(warn / hard) * 100}%` }} title="04:30 warn" />
          </div>
          <div className="gauge-legend">
            <span>0:00</span>
            <span className="warn-text">04:30 warn</span>
            <span className="breach-text">05:00 hard</span>
          </div>
        </div>
      </section>

      <section className="cards">
        <article className={`card status-${status}`}>
          <p className="card-kicker">Compliance</p>
          <h2>Sub-5-Min Dispatch</h2>
          <p className="card-stat">{meta.label}</p>
          <p className="card-detail">
            Warn @ {formatDuration(warn)} · Hard @ {formatDuration(hard)}
            <br />
            Samples over 04:30: {snap?.breachCount ?? 0}
          </p>
        </article>

        <article className="card">
          <p className="card-kicker">Live sockets</p>
          <h2>Active WebSocket Sockets</h2>
          <p className="card-stat">{snap?.sockets.total ?? 0}</p>
          <p className="card-detail">
            Disp {snap?.sockets.dispatchers ?? 0} · Drv {snap?.sockets.drivers ?? 0} · ER{' '}
            {snap?.sockets.hospitals ?? 0} · Adm {snap?.sockets.admins ?? 0} · Doc{' '}
            {snap?.sockets.doctors ?? 0}
          </p>
        </article>

        <article className="card">
          <p className="card-kicker">Process</p>
          <h2>System Uptime</h2>
          <p className="card-stat">
            {snap?.processUptimeSec != null ? formatUptime(snap.processUptimeSec) : snap?.engineOk ? 'Live' : '—'}
          </p>
          <p className="card-detail">
            Engine {snap?.engineOk ? 'online' : 'offline'} · Poll {POLL_MS / 1000}s
            <br />
            Last sync {snap ? new Date(snap.fetchedAt).toLocaleTimeString() : '—'}
            {tick > 0 ? ` · #${tick}` : ''}
          </p>
        </article>
      </section>

      {snap?.error ? <p className="banner-error">{snap.error}</p> : null}

      <footer className="foot">
        Native monitor · proxied from <code>:8080/metrics</code> · memory-capped Vite (1 GB heap)
      </footer>
    </div>
  );
}
