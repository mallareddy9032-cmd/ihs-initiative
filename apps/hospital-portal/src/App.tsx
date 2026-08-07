import { useEffect, useMemo, useState } from 'react';
import { useHospitalSocket } from './hooks/useHospitalSocket';
import {
  CLINICAL_ORDERS,
  DEMO_INCOMING,
  DEMO_VAULT,
  FACILITY,
  INITIAL_BAYS,
  type ClinicalOrder,
  type IncomingTransport,
  type TraumaBay,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function formatEtaCountdown(deadlineMs?: number, fallbackMin?: number): string {
  if (!deadlineMs) {
    if (fallbackMin == null) return '--:--';
    const m = Math.floor(fallbackMin);
    const s = Math.round((fallbackMin - m) * 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const remain = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  const m = Math.floor(remain / 60);
  const s = remain % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function hrTone(hr: number): string {
  if (hr >= 110 || hr <= 50) return 'alert-red';
  if (hr >= 100) return 'alert-amber';
  return '';
}

function spo2Tone(spo2: number): string {
  if (spo2 < 90) return 'alert-red';
  if (spo2 < 95) return 'alert-amber';
  return '';
}

function EcgWave() {
  return (
    <svg className="ecg-wave" viewBox="0 0 320 48" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 24 H40 L48 24 L56 8 L64 40 L72 18 L80 24 H120 L128 24 L136 6 L144 42 L152 16 L160 24 H200 L208 24 L216 10 L224 38 L232 20 L240 24 H280 L288 24 L296 8 L304 40 L312 18 L320 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const { connectionState, incoming, setIncoming, removeCase, toast, setToast, error } =
    useHospitalSocket();
  const [bays, setBays] = useState<TraumaBay[]>(INITIAL_BAYS);
  const [orders, setOrders] = useState<ClinicalOrder[]>(CLINICAL_ORDERS);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo<IncomingTransport | null>(() => {
    if (incoming.length > 0) return incoming[0];
    return null;
  }, [incoming]);

  const availableCount = bays.filter((b) => b.state === 'AVAILABLE').length;
  const enRouteCount = Math.max(incoming.length, active ? 1 : 0);
  const avgTriage = '02:15';

  const syncDemo = () => {
    setIncoming([
      {
        ...DEMO_INCOMING,
        timestamp: new Date().toISOString(),
        eta_deadline_ms: Date.now() + 3 * 60_000 + 40_000,
      },
    ]);
    setBays((prev) =>
      prev.map((b) =>
        b.id === 'T-03'
          ? {
              ...b,
              state: 'RESERVED',
              caseId: DEMO_INCOMING.case_id,
              patientName: DEMO_INCOMING.patient_name,
              doctor: FACILITY.dutyOfficer,
              team: 'Cardiac Care Unit',
            }
          : b,
      ),
    );
    setOrders(CLINICAL_ORDERS.map((o) => ({ ...o, sent: false })));
    setToast('Demo pre-arrival stream loaded · Unit AP-02-EX-2214');
  };

  const simulateIncoming = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/demo/incoming-er`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ihs_uid: 'IHS-8802',
          fleet_id: 'ALS-02',
          patient_name: 'Lakshmi R.',
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Demo failed');
      setToast('Demo inbound transport pushed');
    } catch {
      syncDemo();
    } finally {
      setBusy(false);
    }
  };

  const reserveBay = async (bayId: string) => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/hospital/reserve-bay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: active.case_id,
          bay_id: bayId,
          er_doctor: FACILITY.dutyOfficer,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error || 'Reserve failed');
      }
    } catch {
      /* offline / local reserve */
    }

    setBays((prev) =>
      prev.map((b) => {
        if (b.caseId === active.case_id && b.id !== bayId) {
          return {
            ...b,
            state: 'AVAILABLE',
            caseId: undefined,
            patientName: undefined,
            doctor: undefined,
            team: undefined,
          };
        }
        if (b.id === bayId) {
          return {
            ...b,
            state: 'RESERVED',
            caseId: active.case_id,
            patientName: active.patient_name,
            doctor: FACILITY.dutyOfficer,
            team: active.assigned_team || 'Cardiac Care Unit',
          };
        }
        return b;
      }),
    );
    setIncoming((prev) =>
      prev.map((item) =>
        item.case_id === active.case_id
          ? { ...item, reserved_bay: bayId, assigned_er_doctor: FACILITY.dutyOfficer }
          : item,
      ),
    );
    setToast(`Reserved ${bayId} for Unit ${active.vehicle_reg || 'AP-02-EX-2214'}`);
    setBusy(false);
  };

  const confirmIntake = async () => {
    if (!active) return;
    const bayId = active.reserved_bay || bays.find((b) => b.caseId === active.case_id)?.id || 'T-03';
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/hospital/er-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: active.case_id,
          bay_id: bayId,
          er_doctor: FACILITY.dutyOfficer,
        }),
      });
    } catch {
      /* local intake */
    }
    setBays((prev) =>
      prev.map((b) =>
        b.id === bayId
          ? {
              ...b,
              state: 'OCCUPIED',
              caseId: active.case_id,
              patientName: active.patient_name,
              doctor: FACILITY.dutyOfficer,
            }
          : b,
      ),
    );
    removeCase(active.case_id);
    setToast('ER intake confirmed — trauma bay occupied');
    setBusy(false);
  };

  const sendOrder = (orderId: string) => {
    if (!active) return;
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, sent: true } : o)));
    const label = orders.find((o) => o.id === orderId)?.label || orderId;
    setToast(`Directive sent to ${active.driver_name || 'crew'}: ${label}`);
  };

  const unitLabel = active
    ? `${active.vehicle_reg || 'AP-02-EX-2214'} ${active.vehicle_type || 'Force Traveller ALS'}`
    : '—';
  const etaLabel = active ? formatEtaCountdown(active.eta_deadline_ms, active.eta_minutes) : '--:--';
  const wsLive = connectionState === 'open';

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* A. Granola-Style ER Header */}
      <header className="topbar">
        <div className="identity">
          <div className="serif brand-title">Hospital ER Triage</div>
          <strong>
            {FACILITY.name} · {FACILITY.dept}
          </strong>
        </div>

        <div className="kpi-row">
          <div className="kpi-badge mint">
            <span>Active Trauma Beds</span>
            <strong className="mono">
              {availableCount} Available / {bays.length} Total
            </strong>
          </div>
          <div className="kpi-badge cyan">
            <span>Incoming Ambulances</span>
            <strong className="mono">{enRouteCount} En Route</strong>
          </div>
          <div className="kpi-badge">
            <span>Avg Triage Time</span>
            <strong className="mono">{avgTriage}m</strong>
          </div>
        </div>

        <div className="header-actions">
          <div className="officer">
            <div className="avatar" aria-hidden>
              MA
            </div>
            <div>
              <strong>{FACILITY.dutyOfficer}</strong>
              <span>{FACILITY.dutyRole}</span>
            </div>
          </div>
          <div className={`sync-pill ${wsLive ? 'live' : 'offline'}`}>
            <span className="pulse-dot" />
            {wsLive ? 'WEBSOCKET SYNC ACTIVE' : `SYNC ${connectionState.toUpperCase()}`}
          </div>
        </div>
      </header>

      {error && !wsLive && (
        <div className="err-banner">
          {error} · Demo mode available offline
        </div>
      )}

      <main className="layout">
        <div className="col-primary">
          {/* B. Incoming Ambulance Pre-Arrival Card */}
          <section className="card dark-card incoming-card flash-critical">
            <div className="card-head">
              <h2 className="serif">Incoming Trauma Telemetry</h2>
              {!active && (
                <button
                  type="button"
                  className="btn btn-amber ios-press"
                  disabled={busy}
                  onClick={() => void simulateIncoming()}
                >
                  Load Demo Pre-Arrival
                </button>
              )}
            </div>

            {!active ? (
              <div className="empty">
                Awaiting paramedic HUD stream from App #3.
                <br />
                Unit telemetry appears when an ALS transport is en route to GGH.
              </div>
            ) : (
              <>
                <div className="incoming-grid">
                  <div className="unit-block">
                    <span className="eyebrow">Incoming Unit</span>
                    <strong>{unitLabel}</strong>
                    <em>Driver: {active.driver_name || 'Suresh Naidu'}</em>
                    <span className="status-chip cyan">
                      ● {active.driver_status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="eta-block">
                    <span className="eyebrow">Target Arrival</span>
                    <div className={`eta-value mono ${etaLabel === '00:00' ? 'critical' : ''}`}>
                      {etaLabel}
                    </div>
                    <span className="eta-sub">ETA Mins</span>
                  </div>
                </div>
                <div className="patient-strip">
                  <div>
                    <span className="eyebrow">Patient Profile</span>
                    <h3 className="serif">
                      {active.patient_name} · {active.ihs_uid} · Age {active.patient_age}
                    </h3>
                    <p className="complaint">{active.chief_complaint}</p>
                  </div>
                  <span className="priority-pill RED">● CRITICAL RESUSCITATION</span>
                </div>
              </>
            )}
          </section>

          {/* C. Real-Time Streaming Pre-Arrival Vitals Monitor */}
          <section className="card dark-card vitals-monitor">
            <div className="card-head">
              <h2 className="serif">Pre-Arrival Vitals Monitor</h2>
              <span className="stream-tag cyan">● LIVE TELE-TRIAGE</span>
            </div>
            {active ? (
              <>
                <div className="vitals-grid">
                  <div className={`vital-tile ${hrTone(active.vitals.hr)}`}>
                    <span>Heart Rate</span>
                    <strong className="mono">{active.vitals.hr}</strong>
                    <em>BPM</em>
                  </div>
                  <div className={`vital-tile ${spo2Tone(active.vitals.spo2)}`}>
                    <span>SpO₂</span>
                    <strong className="mono">{active.vitals.spo2}%</strong>
                    <em>{active.vitals.on_room_air !== false ? 'on Room Air' : 'on O₂'}</em>
                  </div>
                  <div className="vital-tile">
                    <span>Blood Pressure</span>
                    <strong className="mono">
                      {active.vitals.bp_sys}/{active.vitals.bp_dia}
                    </strong>
                    <em>mmHg</em>
                  </div>
                </div>
                <div className="ecg-panel">
                  <div className="ecg-meta">
                    <span>Simulated ECG Waveform Preview</span>
                    <strong className="mono">Lead II · 25 mm/s</strong>
                  </div>
                  <EcgWave />
                  <p className="care-note">
                    <span>Care Notes</span>
                    {active.vitals.note || 'O2 initiated @ 4L/min, IV access secured'}
                  </p>
                </div>
              </>
            ) : (
              <div className="empty compact">No streaming vitals — load a pre-arrival case.</div>
            )}
          </section>

          {/* E. Clinical Directives */}
          <section className="card mint-card">
            <div className="card-head">
              <h2 className="serif">Pre-Arrival Clinical Directives</h2>
              <span className="muted">Orders → approaching ALS crew</span>
            </div>
            <div className="order-grid">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`order-btn ios-press ${order.sent ? 'sent' : ''}`}
                  disabled={!active || order.sent || busy}
                  onClick={() => sendOrder(order.id)}
                >
                  [ {order.label} ]
                  {order.sent && <em>SENT</em>}
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="col-side">
          {/* D. Trauma Bay Allocation Grid */}
          <section className="card mint-card">
            <div className="card-head">
              <h2 className="serif">Trauma Bay Allocation</h2>
              <span className="muted">
                {availableCount} free · T-01–T-06
              </span>
            </div>
            <div className="bay-grid">
              {bays.map((bay) => {
                const isAvail = bay.state === 'AVAILABLE';
                const isOcc = bay.state === 'OCCUPIED';
                const isRes = bay.state === 'RESERVED';
                return (
                  <article
                    key={bay.id}
                    className={`bay-card ios-press ${bay.state.toLowerCase()}`}
                  >
                    <div className="bay-top">
                      <h3>{bay.label}</h3>
                      <span className={`bay-state ${bay.state}`}>
                        {isAvail && '🟢 Available'}
                        {isOcc && '🔴 Occupied'}
                        {isRes && '🔵 Pre-Reserved'}
                      </span>
                    </div>
                    <p>
                      {isOcc && (bay.patientName || 'Resuscitation in progress')}
                      {isRes &&
                        `${bay.patientName || 'Assigned'} · Team: ${bay.team || 'Cardiac Care Unit'}`}
                      {isAvail && 'Ready for allocation'}
                    </p>
                    {isAvail && active && (
                      <button
                        type="button"
                        className="btn btn-primary ios-press"
                        disabled={busy}
                        onClick={() => void reserveBay(bay.id)}
                      >
                        Reserve for Unit {active.vehicle_reg || 'AP-02-EX-2214'}
                      </button>
                    )}
                    {isRes && bay.caseId === active?.case_id && (
                      <button
                        type="button"
                        className="btn btn-danger ios-press"
                        disabled={busy}
                        onClick={() => void confirmIntake()}
                      >
                        Confirm ER Intake
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* F. Vault Patient Medical History */}
          <section className="card vault-card">
            <div className="card-head">
              <h2 className="serif">Vault Medical History</h2>
              <span className="stream-tag">App #1 Sync</span>
            </div>
            <div className="vault-grid">
              <div>
                <span className="eyebrow">Known Allergies</span>
                <strong className="alert-red-text">{DEMO_VAULT.allergies.join(', ')}</strong>
              </div>
              <div>
                <span className="eyebrow">Pre-existing Conditions</span>
                <strong>{DEMO_VAULT.conditions.join(', ')}</strong>
              </div>
              <div className="vault-rx">
                <span className="eyebrow">Active Prescriptions</span>
                <ul>
                  {DEMO_VAULT.prescriptions.map((rx) => (
                    <li key={rx}>{rx}</li>
                  ))}
                </ul>
              </div>
            </div>
            {active && (
              <p className="vault-patient mono">
                Synced · {active.patient_name} · {active.ihs_uid}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
