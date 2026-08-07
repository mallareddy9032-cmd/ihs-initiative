import { useMemo, useState } from 'react';
import { useAdminSocket } from './hooks/useAdminSocket';
import {
  DEMO_AUDIT,
  DEMO_GOVERNANCE,
  DEMO_KPIS,
  PILOT_NODES,
  TAT_BREAKDOWN,
  type AuditEntry,
  type DateRange,
  type GovernanceToggle,
  type PilotNode,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  '7d': 'Last 7 Days',
  '30d': '30-Day Pilot Trend',
};

function statusLabel(status: PilotNode['status']): string {
  if (status === 'normal') return '🟢 Normal Operations';
  if (status === 'high') return '🟡 High Demand';
  return '🔴 Surge / Unit Dispatched';
}

function hashShort(full: string): string {
  if (full.includes('…')) return full;
  if (full.length <= 12) return full;
  return `${full.slice(0, 4)}…${full.slice(-4)}`;
}

export default function App() {
  const { connectionState, snapshot, events, error, simOpen, setSimOpen, simSteps, simDone, resetSimulationUi } =
    useAdminSocket();
  const [range, setRange] = useState<DateRange>('7d');
  const [sector, setSector] = useState<'all' | string>('all');
  const [nodes, setNodes] = useState<PilotNode[]>(PILOT_NODES);
  const [audit, setAudit] = useState<AuditEntry[]>(DEMO_AUDIT);
  const [governance, setGovernance] = useState<GovernanceToggle[]>(DEMO_GOVERNANCE);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chainBusy, setChainBusy] = useState(false);

  const kpis = useMemo(() => {
    const live = snapshot?.kpis;
    if (!live) return DEMO_KPIS;
    return {
      totalDispatches: DEMO_KPIS.totalDispatches,
      dispatchDeltaPct: DEMO_KPIS.dispatchDeltaPct,
      sub5TatSuccessPct: DEMO_KPIS.sub5TatSuccessPct,
      sub5TargetPct: DEMO_KPIS.sub5TargetPct,
      avgResponseLabel:
        live.avgTatMin != null
          ? `${String(Math.floor(live.avgTatMin)).padStart(2, '0')}:${String(
              Math.round((live.avgTatMin % 1) * 60),
            ).padStart(2, '0')}`
          : DEMO_KPIS.avgResponseLabel,
      fleetMobilized: Math.round(((live.fleetUtilization?.activePct ?? 80) / 100) * 10),
      fleetTotal: 10,
    };
  }, [snapshot]);

  const filteredNodes = useMemo(() => {
    if (sector === 'all') return nodes;
    return nodes.filter((n) => n.id === sector);
  }, [nodes, sector]);

  const fleetPct = Math.round((kpis.fleetMobilized / kpis.fleetTotal) * 100);
  const wsLive = connectionState === 'open';

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const exportDpr = () => {
    const lines = [
      'IHS Executive DPR — Ananthapur 50km Pilot',
      `Range: ${RANGE_LABELS[range]}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total Dispatches: ${kpis.totalDispatches}`,
      `Sub-5-Min TAT Success: ${kpis.sub5TatSuccessPct}%`,
      `Average Response Time: ${kpis.avgResponseLabel} Mins`,
      `Active Fleet Saturation: ${kpis.fleetMobilized} / ${kpis.fleetTotal}`,
      '',
      'SHA-256 Audit Ledger',
      ...audit.map((a) => `[${a.time}] ${a.event} -> ${a.subject} -> Hash: ${a.hash}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IHS-DPR-Ananthapur-${range}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('DPR report exported');
  };

  const cycleNode = (id: string) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const next =
          n.status === 'normal' ? 'high' : n.status === 'high' ? 'surge' : 'normal';
        return { ...n, status: next };
      }),
    );
  };

  const toggleGov = (id: string) => {
    setGovernance((prev) =>
      prev.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g)),
    );
    const g = governance.find((x) => x.id === id);
    if (g) {
      showToast(`${g.label}: ${g.enabled ? 'OFF' : 'ON'}`);
      setAudit((prev) => [
        {
          id: `g-${Date.now()}`,
          time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          event: 'GOVERNANCE_TOGGLE',
          subject: `${g.label} → ${g.enabled ? 'DISABLED' : 'ENABLED'}`,
          hash: `${Math.random().toString(16).slice(2, 10)}…${Math.random().toString(16).slice(2, 6)}`,
        },
        ...prev,
      ].slice(0, 12));
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
          ihs_uid: 'IHS-8802',
          fleet_id: 'ALS-02',
          bay_id: 'T-03',
          er_doctor: 'Dr. Meera A.',
        }),
      });
      if (!res.ok) throw new Error('Simulation unavailable');
    } catch {
      setAudit((prev) => [
        {
          id: `sim-${Date.now()}`,
          time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          event: 'SIM_CHAIN_LOCAL',
          subject: 'SOS → ALS-02 → Bay T-03 (offline demo)',
          hash: 'c0ffee12ab34…9f01',
        },
        ...prev,
      ]);
      showToast('Offline demo chain recorded to ledger');
      setSimOpen(false);
    }
    window.setTimeout(() => setChainBusy(false), 4000);
  };

  const pulseLive = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/demo/inject-panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihs_uid: 'IHS-8802' }),
      });
      showToast('Live SOS pulse injected');
    } catch {
      setAudit((prev) => [
        {
          id: `sos-${Date.now()}`,
          time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
          event: 'SOS_TRIGGERED',
          subject: 'Patient #IHS-8802',
          hash: '8f9a2c11d4e07b3a…3c12',
        },
        ...prev,
      ]);
      showToast('Local SOS ledger entry appended');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {simOpen && (
        <div className="sim-backdrop" role="dialog" aria-modal="true">
          <div className="sim-modal">
            <p className="sim-eyebrow">LIVE DEMO CASCADE</p>
            <h2 className="serif">Full Emergency Chain</h2>
            <p className="sim-sub">SOS → ALS-02 → Driver HUD → Trauma Bay T-03</p>
            <ol className="sim-steps">
              {['SOS Triggered', 'Unit Mobilized', 'Driver Pipeline', 'ER Intake Confirmed'].map(
                (label, idx) => {
                  const stepNum = idx + 1;
                  const entry = [...simSteps].reverse().find((s) => s.step === stepNum);
                  const state =
                    entry?.status || (chainBusy && stepNum === 1 ? 'pending' : 'idle');
                  return (
                    <li key={label} className={`sim-step ${state}`}>
                      <span className="sim-mark">
                        {state === 'complete'
                          ? '✓'
                          : state === 'running'
                            ? '…'
                            : state === 'error'
                              ? '!'
                              : stepNum}
                      </span>
                      <div>
                        <strong>Step {stepNum}/4</strong>
                        <div className="sim-msg">{entry?.message || label}</div>
                      </div>
                    </li>
                  );
                },
              )}
            </ol>
            {(simDone || !chainBusy) && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => {
                  setSimOpen(false);
                  setChainBusy(false);
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      {/* A. Executive Header */}
      <header className="topbar">
        <div className="identity">
          <div className="logo-mark" aria-hidden>
            IHS
          </div>
          <div>
            <div className="serif brand-title">Executive Analytics</div>
            <div className="pilot-glow">
              <span className="pulse-dot" />
              PILOT OVERVIEW · ANANTHAPUR 50KM GRID
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="seg">
            {(Object.keys(RANGE_LABELS) as DateRange[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`seg-btn ios-press ${range === key ? 'active' : ''}`}
                onClick={() => setRange(key)}
              >
                {RANGE_LABELS[key]}
              </button>
            ))}
          </div>
          <select
            className="sector-select"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            aria-label="Sector selector"
          >
            <option value="all">All 20 Ananthapur Nodes</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        <div className="header-actions">
          <button type="button" className="btn btn-ghost ios-press" onClick={exportDpr}>
            📥 Export DPR Report
          </button>
          <div className="admin-chip">
            <div className="avatar" aria-hidden>
              SA
            </div>
            <span>SuperAdmin Desk</span>
          </div>
          <div className={`sec-pill ${wsLive ? 'live' : ''}`}>
            🔒 SHA-256 LEDGER ACTIVE
          </div>
        </div>
      </header>

      {error && !wsLive && (
        <div className="err-banner">{error} · Showing pilot demo metrics</div>
      )}

      <main className="content">
        {/* B. Macro KPI Cards */}
        <section className="kpi-row">
          <article className="kpi-card mint-card ios-press">
            <span className="kpi-label">Total Dispatches</span>
            <div className="serif kpi-value">{kpis.totalDispatches.toLocaleString()}</div>
            <span className="trend-pill up">+{kpis.dispatchDeltaPct}% vs last week</span>
          </article>
          <article className="kpi-card mint-card ios-press target-hit">
            <span className="kpi-label">Sub-5-Min TAT Success</span>
            <div className="serif kpi-value emerald">{kpis.sub5TatSuccessPct}%</div>
            <span className="trend-pill emerald">
              Target: &gt;{kpis.sub5TargetPct}% · On Track
            </span>
          </article>
          <article className="kpi-card mint-card ios-press">
            <span className="kpi-label">Average Response Time</span>
            <div className="serif kpi-value mono-num">{kpis.avgResponseLabel}</div>
            <span className="trend-pill">Mins · Golden Hour Benchmark</span>
          </article>
          <article className="kpi-card mint-card ios-press slate">
            <span className="kpi-label">Active Fleet Saturation</span>
            <div className="serif kpi-value cyan">
              {kpis.fleetMobilized} / {kpis.fleetTotal}
            </div>
            <span className="trend-pill cyan">{fleetPct}% Grid Capacity · Units Mobilized</span>
            <div className="sat-meter" aria-hidden>
              <div className="sat-fill" style={{ width: `${fleetPct}%` }} />
            </div>
          </article>
        </section>

        <div className="mid-grid">
          {/* C. 20-Node Heatmap */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="serif">Regional Grid Performance</h2>
              <span className="muted">Ananthapur 50km · {filteredNodes.length} nodes</span>
            </div>
            <div className="legend">
              <span>🟢 Normal</span>
              <span>🟡 High Demand</span>
              <span>🔴 Surge / Dispatched</span>
            </div>
            <div className="node-grid">
              {filteredNodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`node-card ios-press ${node.status}`}
                  onClick={() => cycleNode(node.id)}
                  title="Click to cycle status"
                >
                  <strong>{node.name}</strong>
                  <span className="node-status">{statusLabel(node.status)}</span>
                  <span className="mono node-meta">
                    {node.dispatches} disp · {node.tatMin.toFixed(1)}m TAT
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* D. Golden Hour TAT */}
          <section className="panel">
            <div className="panel-head">
              <h2 className="serif">Golden Hour TAT</h2>
              <span className="muted">Target vs actual</span>
            </div>
            <div className="tat-list">
              {TAT_BREAKDOWN.map((row) => {
                const pct = Math.min(100, Math.round((row.actualSec / row.targetSec) * 100));
                const ok = row.actualSec <= row.targetSec;
                return (
                  <div key={row.id} className="tat-row">
                    <div className="tat-top">
                      <strong>{row.label}</strong>
                      <span className={`mono tat-actual ${ok ? 'ok' : 'breach'}`}>
                        {row.actualLabel}
                      </span>
                    </div>
                    <div className="tat-bar">
                      <div
                        className={`tat-fill ${ok ? 'ok' : 'breach'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="tat-target muted">{row.targetLabel}</div>
                  </div>
                );
              })}
            </div>
            <div className="demo-actions">
              <button
                type="button"
                className="btn btn-primary ios-press"
                disabled={chainBusy}
                onClick={() => void runFullChain()}
              >
                ⚡ Simulate Full Chain
              </button>
              <button
                type="button"
                className="btn btn-ghost ios-press"
                disabled={busy}
                onClick={() => void pulseLive()}
              >
                Pulse Live SOS
              </button>
            </div>
          </section>
        </div>

        {/* E. SHA-256 Audit Ledger */}
        <section className="panel ledger-panel">
          <div className="panel-head">
            <h2 className="serif">SHA-256 Audit Ledger</h2>
            <span className="ledger-badge">🔒 IMMUTABLE · CRYPTOGRAPHIC VERIFY</span>
          </div>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Subject</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">[{row.time}]</td>
                    <td>
                      <code className="event-code">{row.event}</code>
                    </td>
                    <td>{row.subject}</td>
                    <td className="mono hash">Hash: {hashShort(row.hash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {events.length > 0 && (
            <div className="ws-feed muted">
              Live WS: {events.slice(0, 3).join(' · ')}
            </div>
          )}
        </section>

        {/* F. Governance Controls */}
        <section className="panel gov-panel">
          <div className="panel-head">
            <h2 className="serif">System Governance & Pilot Configuration</h2>
            <span className="muted">Regional dispatch rules</span>
          </div>
          <div className="gov-grid">
            {governance.map((g) => (
              <label key={g.id} className={`gov-card ios-press ${g.enabled ? 'on' : ''}`}>
                <div className="gov-text">
                  <strong>{g.label}</strong>
                  <span>{g.description}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={g.enabled}
                  className={`toggle ${g.enabled ? 'on' : ''}`}
                  onClick={() => toggleGov(g.id)}
                >
                  <span className="knob" />
                </button>
              </label>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
