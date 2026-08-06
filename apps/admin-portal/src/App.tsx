import { useMemo, useState } from 'react';
import { useAdminSocket } from './hooks/useAdminSocket';
import type { RegionFilter } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const STEP_LABELS = [
  'SOS Triggered',
  'Unit Mobilized',
  'Driver Pipeline',
  'ER Intake Confirmed',
];

export default function App() {
  const {
    connectionState,
    snapshot,
    events,
    error,
    simOpen,
    setSimOpen,
    simSteps,
    simDone,
    resetSimulationUi,
  } = useAdminSocket();
  const [region, setRegion] = useState<RegionFilter>('ALL');
  const [busy, setBusy] = useState(false);
  const [chainBusy, setChainBusy] = useState(false);

  const regions = useMemo(() => {
    if (!snapshot) return [];
    if (region === 'ALL') return snapshot.regions;
    return snapshot.regions.filter((r) => r.id === region);
  }, [snapshot, region]);

  const fleet = useMemo(() => {
    if (!snapshot) return [];
    if (region === 'ALL') return snapshot.fleetHealth;
    const name =
      region === 'VIZAG'
        ? 'Vizag'
        : region === 'HYD'
          ? 'Hyderabad'
          : 'Khammam';
    return snapshot.fleetHealth.filter((f) => f.region.includes(name));
  }, [snapshot, region]);

  const kpis = snapshot?.kpis;
  const tatTone =
    !kpis ? 'live' : kpis.avgTatMin <= kpis.tatTargetMin ? 'good' : kpis.avgTatMin <= 6 ? 'warn' : 'bad';

  const pulseLive = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/demo/inject-panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihs_uid: 'IHS-ADMIN-00001' }),
      });
    } finally {
      setBusy(false);
    }
  };

  const runFullChain = async () => {
    setChainBusy(true);
    resetSimulationUi();
    setSimOpen(true);
    try {
      const res = await fetch(`${API_BASE}/v1/simulate/full-chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ihs_uid: 'IHS-ADMIN-00001',
          fleet_id: 'AMB-VSKP-07',
          bay_id: 'BAY-3',
          er_doctor: 'Dr. Meera Krishnan',
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || 'Failed to start simulation');
      }
    } catch (err) {
      setSimOpen(true);
      alert(err instanceof Error ? err.message : 'Simulation failed');
      setChainBusy(false);
      return;
    }
    // Keep button locked until SIMULATION_COMPLETE / ~5s fallback
    window.setTimeout(() => setChainBusy(false), 6000);
  };

  return (
    <div className="app">
      {simOpen && (
        <div className="sim-backdrop" role="dialog" aria-modal="true">
          <div className="sim-modal">
            <div className="sim-eyebrow">LIVE DEMO CASCADE</div>
            <h2>Full Emergency Chain</h2>
            <p className="sim-sub">
              SOS → Dispatch AMB-VSKP-07 → Driver pipeline → Trauma Bay 3 intake
            </p>
            <ol className="sim-steps">
              {STEP_LABELS.map((label, idx) => {
                const stepNum = idx + 1;
                const entry = [...simSteps]
                  .reverse()
                  .find((s) => s.step === stepNum);
                const state = entry?.status || (chainBusy && stepNum === 1 ? 'pending' : 'idle');
                return (
                  <li key={label} className={`sim-step ${state}`}>
                    <span className="sim-mark">
                      {state === 'complete' ? '✓' : state === 'running' ? '…' : state === 'error' ? '!' : stepNum}
                    </span>
                    <div>
                      <strong>
                        Step {stepNum}/4{entry?.status === 'complete' ? ' Complete' : ''}
                        {entry?.status === 'running' ? '…' : ''}
                      </strong>
                      <div className="sim-msg">{entry?.message || label}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
            {(simDone || !chainBusy) && simSteps.some((s) => s.status === 'complete') && (
              <button
                type="button"
                className="btn"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => {
                  setSimOpen(false);
                  setChainBusy(false);
                }}
              >
                {simDone ? 'Close' : 'Hide progress'}
              </button>
            )}
          </div>
        </div>
      )}

      <header className="topbar">
        <div className="brand-row">
          <div className="brand">IHS EXEC</div>
          <div>
            <h1>SuperAdmin · Regional Analytics</h1>
            <p>Node AP-SOUTH-2 · global emergency telemetry</p>
          </div>
        </div>
        <div className="controls">
          <select
            className="filter"
            value={region}
            onChange={(e) => setRegion(e.target.value as RegionFilter)}
          >
            <option value="ALL">All Regions</option>
            <option value="VIZAG">Vizag Metro</option>
            <option value="HYD">Hyderabad Central</option>
            <option value="KHAMMAM">Khammam Range</option>
          </select>
          <div className={`pill ${connectionState}`}>{connectionState.toUpperCase()}</div>
          <button
            type="button"
            className="btn-chain"
            disabled={chainBusy}
            onClick={() => void runFullChain()}
          >
            ⚡ SIMULATE FULL EMERGENCY CHAIN
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void pulseLive()}>
            Pulse live SOS
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: '#7f1d1d', padding: '8px 22px', fontSize: 13 }}>{error}</div>
      )}

      <div className="content">
        <section className="kpi-grid">
          <article className={`kpi ios-press ios-spring ${tatTone}`}>
            <div className="label">Avg Emergency TAT</div>
            <div className="value">{kpis ? `${kpis.avgTatMin.toFixed(1)}m` : '—'}</div>
            <div className="hint">Target: &lt; {kpis?.tatTargetMin ?? 5.0} mins</div>
          </article>
          <article className="kpi live ios-press ios-spring">
            <div className="label">Active Incidents</div>
            <div className="value">{kpis?.activeIncidents ?? '—'}</div>
            <div className="hint">Live counter · WS telemetry</div>
          </article>
          <article className="kpi ios-press ios-spring">
            <div className="label">Fleet Utilization</div>
            <div className="value" style={{ fontSize: 18, lineHeight: 1.35 }}>
              {kpis
                ? `${kpis.fleetUtilization.activePct}% / ${kpis.fleetUtilization.standbyPct}% / ${kpis.fleetUtilization.maintenancePct}%`
                : '—'}
            </div>
            <div className="hint">Active · Standby · Maintenance</div>
            {kpis && (
              <div className="ios-pill-meter" aria-label="Fleet active share">
                <div
                  className="fill blue"
                  style={{ width: `${kpis.fleetUtilization.activePct}%` }}
                />
              </div>
            )}
          </article>
          <article
            className={`kpi ios-press ios-spring ${
              !kpis ? '' : kpis.bedSaturationPct >= 90 ? 'bad' : kpis.bedSaturationPct >= 75 ? 'warn' : 'good'
            }`}
          >
            <div className="label">Hospital Bed Saturation</div>
            <div className="value">{kpis ? `${kpis.bedSaturationPct}%` : '—'}</div>
            <div className="hint">Trauma bays occupied (regional avg)</div>
            <div className="ios-pill-meter" aria-label="Bed saturation">
              <div
                className={`fill ${
                  !kpis
                    ? ''
                    : kpis.bedSaturationPct >= 90
                      ? 'red'
                      : kpis.bedSaturationPct >= 75
                        ? 'amber'
                        : 'green'
                }`}
                style={{ width: `${kpis?.bedSaturationPct ?? 0}%` }}
              />
            </div>
          </article>
        </section>

        {!!snapshot?.bottlenecks?.length && (
          <div className="alert-banner">
            TRIAGE BOTTLENECK:{' '}
            {snapshot.bottlenecks
              .map(
                (b) =>
                  `${b.region} · ${b.hospital} at ${b.saturationPct}% (${b.severity})`,
              )
              .join(' · ')}
          </div>
        )}

        <section className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Regional Performance Breakdown</h2>
              <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                WS Node · AP-SOUTH-2
              </span>
            </div>
            <div className="panel-body" style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Region / Zone</th>
                    <th>Ambulances</th>
                    <th>Dispatched</th>
                    <th>Avg Response</th>
                    <th>Beds</th>
                    <th>Node Health</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.name}</strong>
                        <div className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                          {r.zone}
                        </div>
                      </td>
                      <td className="mono">{r.activeAmbulances}</td>
                      <td className="mono">{r.dispatchedIncidents}</td>
                      <td className="mono">{r.avgResponseMin.toFixed(1)}m</td>
                      <td className="mono">{r.bedSaturationPct}%</td>
                      <td>
                        <span className={`status-chip ${r.nodeStatus}`}>{r.nodeStatus}</span>
                        <div className="mono" style={{ color: 'var(--muted)', fontSize: 10, marginTop: 4 }}>
                          {r.wsNode}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!regions.length && (
                    <tr>
                      <td colSpan={6} style={{ color: 'var(--muted)' }}>
                        Loading executive snapshot…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Live Telemetry Feed</h2>
              <span className="mono" style={{ color: 'var(--muted)', fontSize: 11 }}>
                {snapshot?.connectivity
                  ? `D${snapshot.connectivity.dispatchers} · Dr${snapshot.connectivity.drivers} · H${snapshot.connectivity.hospitals}`
                  : '—'}
              </span>
            </div>
            <div className="panel-body">
              <div className="event-feed">
                {events.length === 0 && <div>Waiting for global events on /v1/admin/stream…</div>}
                {events.map((line, idx) => (
                  <div key={`${idx}-${line}`}>
                    <strong>▸</strong> {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Hospital Throughput & ER Handoff</h2>
            </div>
            <div className="panel-body">
              <div className="bars">
                <div className="bar-row">
                  <label>
                    <span>ER Handoff Efficiency (arrival → bay admit)</span>
                    <strong>{kpis ? `${kpis.erHandoffAvgMin.toFixed(1)} min` : '—'}</strong>
                  </label>
                  <div className="ios-pill-meter track">
                    <div
                      className={`fill ${
                        !kpis ? '' : kpis.erHandoffAvgMin <= 6 ? 'green' : kpis.erHandoffAvgMin <= 8 ? 'amber' : 'red'
                      }`}
                      style={{
                        width: `${Math.min(100, ((kpis?.erHandoffAvgMin ?? 0) / 12) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {regions.map((r) => (
                  <div className="bar-row" key={r.id}>
                    <label>
                      <span>{r.name} trauma bay saturation</span>
                      <strong>{r.bedSaturationPct}%</strong>
                    </label>
                    <div className="ios-pill-meter track">
                      <div
                        className={`fill ${
                          r.bedSaturationPct >= 90 ? 'red' : r.bedSaturationPct >= 75 ? 'amber' : 'green'
                        }`}
                        style={{ width: `${r.bedSaturationPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Fleet Status Monitor</h2>
            </div>
            <div className="panel-body">
              <div className="bars" style={{ marginBottom: 14 }}>
                <div className="bar-row">
                  <label>
                    <span>Active</span>
                    <strong>{kpis?.fleetUtilization.activePct ?? 0}%</strong>
                  </label>
                  <div className="track">
                    <div
                      className="fill green"
                      style={{ width: `${kpis?.fleetUtilization.activePct ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="bar-row">
                  <label>
                    <span>Standby</span>
                    <strong>{kpis?.fleetUtilization.standbyPct ?? 0}%</strong>
                  </label>
                  <div className="track">
                    <div
                      className="fill"
                      style={{ width: `${kpis?.fleetUtilization.standbyPct ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="bar-row">
                  <label>
                    <span>Maintenance</span>
                    <strong>{kpis?.fleetUtilization.maintenancePct ?? 0}%</strong>
                  </label>
                  <div className="track">
                    <div
                      className="fill amber"
                      style={{ width: `${kpis?.fleetUtilization.maintenancePct ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="fleet-list">
                {fleet.map((f) => (
                  <div className="fleet-item" key={f.fleetId}>
                    <div className="top">
                      <span>{f.fleetId}</span>
                      <span>{f.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {f.region} · Fuel/Charge {f.fuelPct}% · Shift {f.shiftHours.toFixed(1)}h
                    </div>
                    {f.alert && <div className="alert">⚠ {f.alert}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
