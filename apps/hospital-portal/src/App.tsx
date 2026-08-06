import { useEffect, useMemo, useState } from 'react';
import { useHospitalSocket } from './hooks/useHospitalSocket';
import {
  ER_DOCTORS,
  INITIAL_BAYS,
  type IncomingTransport,
  type TraumaBay,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function Phase3SchemeBadge() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="phase3-banner" onClick={() => setOpen(true)}>
        <div className="phase3-title">Aarogyasri / PM-JAY Auto-Eligibility Check</div>
        <span className="phase3-tag">[UPCOMING FEATURE - PHASE 3]</span>
        <div className="phase3-hint">Patient intake · government scheme verification roadmap</div>
      </button>
      {open && (
        <div className="phase3-modal-root" role="dialog" aria-modal="true">
          <button type="button" className="phase3-backdrop" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="phase3-modal">
            <p className="phase3-kicker">PHASE 3 ROADMAP</p>
            <h3>Aarogyasri / PM-JAY Auto-Eligibility</h3>
            <p>
              Upcoming automated verification will check Aarogyasri and Ayushman Bharat PM-JAY
              eligibility at ER intake against the patient IHS UID / ABHA linkage, then surface
              cover status before bay assignment and billing handoff.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function formatEta(deadlineMs?: number, fallbackMin?: number): string {
  if (!deadlineMs) {
    return fallbackMin != null ? `Arriving in ${fallbackMin} mins` : 'ETA pending';
  }
  const remain = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
  const m = Math.floor(remain / 60);
  const s = remain % 60;
  if (remain <= 0) return 'ARRIVING NOW';
  if (m <= 0) return `Arriving in ${s}s`;
  return `Arriving in ${m} min ${s.toString().padStart(2, '0')}s`;
}

function triageLabel(p: IncomingTransport['triage_priority']): string {
  if (p === 'RED') return 'RED · CRITICAL';
  if (p === 'YELLOW') return 'YELLOW · URGENT';
  return 'GREEN · STABLE';
}

export default function App() {
  const { connectionState, incoming, removeCase, toast, setToast, error } = useHospitalSocket();
  const [bays, setBays] = useState<TraumaBay[]>(INITIAL_BAYS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doctor, setDoctor] = useState(ER_DOCTORS[0]);
  const [bayChoice, setBayChoice] = useState('BAY-2');
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const selected = useMemo(
    () => incoming.find((x) => x.case_id === selectedId) || incoming[0] || null,
    [incoming, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.case_id);
      if (selected.reserved_bay) setBayChoice(selected.reserved_bay);
      if (selected.assigned_er_doctor) setDoctor(selected.assigned_er_doctor);
    }
  }, [selected?.case_id]);

  const availableBays = bays.filter((b) => b.state === 'AVAILABLE' || b.caseId === selected?.case_id);
  const occupiedPct = Math.round(
    (bays.filter((b) => b.state !== 'AVAILABLE').length / Math.max(bays.length, 1)) * 100,
  );
  const satTone = occupiedPct >= 90 ? 'red' : occupiedPct >= 70 ? 'amber' : '';

  const reserveBay = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/hospital/reserve-bay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: selected.case_id,
          bay_id: bayChoice,
          er_doctor: doctor,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Reserve failed');

      setBays((prev) =>
        prev.map((b) => {
          if (b.caseId === selected.case_id && b.id !== bayChoice) {
            return { ...b, state: 'AVAILABLE' as const, caseId: undefined, patientName: undefined, doctor: undefined };
          }
          if (b.id === bayChoice) {
            return {
              ...b,
              state: 'RESERVED' as const,
              caseId: selected.case_id,
              patientName: selected.patient_name,
              doctor,
            };
          }
          return b;
        }),
      );
      setToast(`Reserved ${bayChoice} · ${doctor}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Reserve failed');
    } finally {
      setBusy(false);
    }
  };

  const confirmIntake = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/hospital/er-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: selected.case_id,
          bay_id: bayChoice,
          er_doctor: doctor,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Intake failed');

      setBays((prev) =>
        prev.map((b) =>
          b.id === bayChoice
            ? {
                ...b,
                state: 'OCCUPIED' as const,
                caseId: selected.case_id,
                patientName: selected.patient_name,
                doctor,
              }
            : b,
        ),
      );
      removeCase(selected.case_id);
      setToast('ER intake confirmed — loop closed to Apps 1–3');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Intake failed');
    } finally {
      setBusy(false);
    }
  };

  const simulateIncoming = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/v1/demo/incoming-er`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihs_uid: 'IHS-ADMIN-00001', fleet_id: 'AMB-VSKP-07' }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Demo failed');
      setToast('Demo inbound transport pushed');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand-block">
          <div className="brand">IHS ER</div>
          <div>
            <h1>Trauma Bay Receiving · Command Triage</h1>
            <p>KGH Visakhapatnam · live ambulance intake</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={`pill ${connectionState}`}>{connectionState.toUpperCase()}</div>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void simulateIncoming()}>
            Simulate inbound
          </button>
        </div>
      </header>

      {error && (
        <div style={{ background: '#7f1d1d', padding: '8px 20px', fontSize: 13 }}>{error}</div>
      )}

      <main className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2>Incoming Emergencies</h2>
            <span className="meta">{incoming.length} active</span>
          </div>
          <div className="panel-body">
            {incoming.length === 0 && (
              <div className="empty">
                Awaiting ambulance transports on <code>/v1/hospital/stream</code>.
                <br />
                Use Driver App status steps or “Simulate inbound”.
              </div>
            )}

            {incoming.map((item) => {
              const selectedCard = selected?.case_id === item.case_id;
              return (
                <article
                  key={item.case_id}
                  className={`incoming-card ios-press ios-spring priority-${item.triage_priority} ${
                    selectedCard ? 'selected' : ''
                  } ${item.triage_priority === 'RED' ? 'flash-red' : ''}`}
                  onClick={() => setSelectedId(item.case_id)}
                >
                  <div className="row">
                    <div>
                      <h3 className="name">{item.patient_name}</h3>
                      <div className="meta">
                        {item.ihs_uid} · Age {item.patient_age} · {item.fleet_id || 'UNIT'}
                      </div>
                    </div>
                    <span className={`badge ${item.triage_priority}`}>
                      {triageLabel(item.triage_priority)}
                    </span>
                  </div>

                  <div className="row">
                    <div className="eta">{formatEta(item.eta_deadline_ms, item.eta_minutes)}</div>
                    <div className="meta" style={{ textAlign: 'right' }}>
                      {item.driver_status.replace(/_/g, ' ')}
                      <br />
                      {item.chief_complaint}
                    </div>
                  </div>

                  <div className="vitals">
                    <div className="vital">
                      <label>HR</label>
                      <strong>{item.vitals.hr}</strong>
                    </div>
                    <div className="vital">
                      <label>SpO₂</label>
                      <strong>{item.vitals.spo2}%</strong>
                    </div>
                    <div className="vital">
                      <label>BP</label>
                      <strong>
                        {item.vitals.bp_sys}/{item.vitals.bp_dia}
                      </strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Trauma Bays / ER Beds</h2>
            <span className="meta">
              {bays.filter((b) => b.state === 'AVAILABLE').length} free
            </span>
          </div>
          <div className="panel-body">
            <div className="sat-row">
              <span>Trauma bay saturation</span>
              <strong>{occupiedPct}%</strong>
            </div>
            <div className="ios-pill-meter" aria-label={`Bay saturation ${occupiedPct}%`}>
              <div className={`fill ${satTone}`} style={{ width: `${occupiedPct}%` }} />
            </div>
            <div className="bay-grid">
              {bays.map((bay) => (
                <div key={bay.id} className={`bay ios-press ios-spring ${bay.state}`}>
                  <div className="row">
                    <h3>{bay.label}</h3>
                    <span className={`state ${bay.state}`}>{bay.state}</span>
                  </div>
                  <p>
                    {bay.patientName || 'No patient assigned'}
                    {bay.doctor ? ` · ${bay.doctor}` : ''}
                  </p>
                  {bay.state === 'AVAILABLE' && selected && (
                    <button
                      type="button"
                      className="btn btn-ghost ios-press"
                      onClick={() => setBayChoice(bay.id)}
                    >
                      Reserve {bay.id.replace('BAY-', 'Bay ')}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="detail">
              <Phase3SchemeBadge />
              <div className="field">
                <label>Selected inbound</label>
                <div className="meta">
                  {selected
                    ? `${selected.patient_name} · ${selected.ihs_uid}`
                    : 'Select a patient from the queue'}
                </div>
              </div>

              <div className="field">
                <label>Assign bay</label>
                <select value={bayChoice} onChange={(e) => setBayChoice(e.target.value)}>
                  {(availableBays.length ? availableBays : bays).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label} ({b.state})
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>On-duty ER doctor</label>
                <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                  {ER_DOCTORS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selected || busy}
                  onClick={() => void reserveBay()}
                >
                  Reserve {bayChoice.replace('BAY-', 'Bay ')}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!selected || busy}
                  onClick={() => void confirmIntake()}
                >
                  Confirm ER Intake
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
