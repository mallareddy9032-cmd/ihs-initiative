import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  endConsult,
  fetchAppointments,
  fetchPatientVault,
  issuePrescription,
  loginClinician,
  startConsult,
} from './api';
import { useDoctorSocket } from './hooks/useDoctorSocket';
import type {
  Appointment,
  CallState,
  ClinicianSession,
  PatientVault,
} from './types';

function typeChip(type: Appointment['type']) {
  return type === 'teleconsult' ? 'chip tele' : 'chip home';
}

function typeLabel(type: Appointment['type']) {
  return type === 'teleconsult' ? 'Teleconsult' : 'GP Home Visit';
}

function capChip(status: string) {
  return status === 'COVERED' ? 'chip covered' : 'chip copay';
}

export default function App() {
  const [session, setSession] = useState<ClinicianSession | null>(null);
  const [uid, setUid] = useState('DOC-101');
  const [pin, setPin] = useState('123456');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const { connectionState, appointments, setAppointments, toast, setToast } =
    useDoctorSocket(Boolean(session));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vault, setVault] = useState<PatientVault | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [busy, setBusy] = useState(false);

  const [drugName, setDrugName] = useState('Amoxicillin 500mg');
  const [dosage, setDosage] = useState('1 tab 3x daily after meals');
  const [duration, setDuration] = useState('5 days');
  const [refills, setRefills] = useState(0);

  const selected = useMemo(
    () => appointments.find((a) => a.id === selectedId) || null,
    [appointments, selectedId],
  );

  useEffect(() => {
    if (!session) return;
    fetchAppointments()
      .then((list) => setAppointments(list))
      .catch((err) => setToast(err instanceof Error ? err.message : 'Queue load failed'));
  }, [session]);

  useEffect(() => {
    if (!selected || !drawerOpen) {
      setVault(null);
      return;
    }
    let cancelled = false;
    setVaultLoading(true);
    fetchPatientVault(selected.ihs_uid)
      .then((v) => {
        if (!cancelled) setVault(v);
      })
      .catch((err) => {
        if (!cancelled) {
          setVault(null);
          setToast(err instanceof Error ? err.message : 'Vault load failed');
        }
      })
      .finally(() => {
        if (!cancelled) setVaultLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.ihs_uid, selected?.id, drawerOpen]);

  const openPatientDrawer = (apt: Appointment) => {
    setSelectedId(apt.id);
    setCallState(apt.status === 'in_consult' ? 'live' : 'idle');
    setDrugName('Amoxicillin 500mg');
    setDosage('1 tab 3x daily after meals');
    setDuration('5 days');
    setRefills(0);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const s = await loginClinician(uid, pin);
      setSession(s);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const onStartVideo = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const apt = await startConsult(selected.id);
      setAppointments((prev) => prev.map((a) => (a.id === apt.id ? apt : a)));
      setCallState('live');
      setToast(`Video consult live with ${apt.patient_name}`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Start failed');
    } finally {
      setBusy(false);
    }
  };

  const onMute = () => {
    setCallState((s) => (s === 'muted' ? 'live' : s === 'live' ? 'muted' : s));
  };

  const onEndConsult = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const apt = await endConsult(selected.id);
      setAppointments((prev) => prev.map((a) => (a.id === apt.id ? apt : a)));
      setCallState('ended');
      setToast('Consult ended');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'End failed');
    } finally {
      setBusy(false);
    }
  };

  const onIssueScript = async () => {
    if (!selected || !session) return;
    if (!drugName.trim() || !dosage.trim() || !duration.trim()) {
      setToast('Drug name, dosage, and duration are required');
      return;
    }
    setBusy(true);
    try {
      await issuePrescription({
        patient_id: selected.ihs_uid,
        ihs_uid: selected.ihs_uid,
        physician: session.name || 'Dr. Ananya Rao',
        appointment_id: selected.id,
        title: `E-Prescription — ${drugName.trim()}`,
        drug_name: drugName.trim(),
        dosage_instructions: dosage.trim(),
        duration: duration.trim(),
        refills: Number(refills) || 0,
        instructions: `${dosage.trim()} · ${duration.trim()} · Refills: ${Number(refills) || 0}`,
        medicines: [
          {
            name: drugName.trim(),
            dose: dosage.trim(),
            duration: duration.trim(),
            quantity: 15,
            refills: Number(refills) || 0,
          },
        ],
      });
      setToast(`E-prescription synced → ${selected.patient_name} Health Vault`);
      const refreshed = await fetchPatientVault(selected.ihs_uid);
      setVault(refreshed);
      setCallState('ended');
      setAppointments((prev) =>
        prev.map((a) => (a.id === selected.id ? { ...a, status: 'completed' as const } : a)),
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Rx issue failed');
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <div className="login-shell">
        <form className="login-card" onSubmit={onLogin}>
          <p className="login-brand">IHS CLINICAL</p>
          <h1>Doctor Console</h1>
          <p>Secure clinician access for teleconsult queue, Health Vault, and e-prescription studio.</p>
          {loginError && <div className="error-banner">{loginError}</div>}
          <div className="field">
            <label htmlFor="uid">Doctor UID</label>
            <input
              id="uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="DOC-101"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="pin">Secure PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Authenticating…' : 'Enter Clinical Console'}
          </button>
          <p className="login-hint">Demo · DOC-101 / 123456 · Dr. Ananya Rao</p>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">IHS DOC</div>
          <div>
            <h1>Doctor & Clinician Console</h1>
            <span>
              {session.name} · {session.uid}
            </span>
          </div>
        </div>
        <div className="top-meta">
          <span className={`pill ${connectionState === 'live' ? 'live' : 'offline'}`}>
            WS {connectionState.toUpperCase()} · :8080
          </span>
          <span className="pill">{appointments.filter((a) => a.status === 'queued').length} QUEUED</span>
          <button className="btn btn-ghost" type="button" onClick={() => setSession(null)}>
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace workspace-queue-only">
        <aside className="panel panel-full">
          <div className="panel-head">
            <h2>Consultation Queue</h2>
            <p>Click a patient to open Consultation & E-Prescription drawer</p>
          </div>
          <div className="queue-list">
            {appointments.length === 0 && (
              <div className="empty">No appointments in queue. Waiting for App #1 bookings…</div>
            )}
            {appointments.map((apt) => (
              <button
                key={apt.id}
                type="button"
                className={`queue-item ${selected?.id === apt.id && drawerOpen ? 'active' : ''}`}
                onClick={() => openPatientDrawer(apt)}
              >
                <div className="name">{apt.patient_name}</div>
                <div className="uid">{apt.ihs_uid}</div>
                <div className="meta">
                  <span className={typeChip(apt.type)}>{typeLabel(apt.type)}</span>
                  <span className={capChip(apt.capitation_status)}>{apt.capitation_status}</span>
                  <span className="chip">{apt.status.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div className="when">{apt.when_label}</div>
                {apt.notes && <div className="when">{apt.notes}</div>}
              </button>
            ))}
          </div>
        </aside>
      </div>

      {drawerOpen && selected && (
        <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Consultation drawer">
          <button type="button" className="drawer-backdrop" aria-label="Close drawer" onClick={closeDrawer} />
          <aside className="drawer-panel">
            <div className="drawer-head">
              <div>
                <p className="drawer-kicker">Consultation & E-Prescription</p>
                <h2>
                  {selected.patient_name}
                  <span className="drawer-uid"> · {selected.ihs_uid}</span>
                </h2>
                <p className="drawer-sub">
                  {typeLabel(selected.type)} · {selected.when_label} · {selected.capitation_status}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={closeDrawer}>
                Close
              </button>
            </div>

            <div className="drawer-body">
              <section className="rx-card">
                <h3>Live Teleconsult</h3>
                <div className={`video-stage compact ${callState === 'live' || callState === 'muted' ? 'live' : ''}`}>
                  <div className="video-copy">
                    <strong>
                      {callState === 'idle' && 'Ready to connect'}
                      {callState === 'live' && `Connected · ${selected.patient_name}`}
                      {callState === 'muted' && 'Mic muted · video active'}
                      {callState === 'ended' && 'Consult ended'}
                    </strong>
                    <span>Simulated A/V · physician {session.name}</span>
                  </div>
                </div>
                <div className="call-controls">
                  <button
                    className="btn btn-ok"
                    type="button"
                    disabled={busy || callState === 'live' || callState === 'muted'}
                    onClick={onStartVideo}
                  >
                    Start Video Call
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={busy || (callState !== 'live' && callState !== 'muted')}
                    onClick={onMute}
                  >
                    {callState === 'muted' ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    className="btn btn-danger"
                    type="button"
                    disabled={busy || callState === 'idle' || callState === 'ended'}
                    onClick={onEndConsult}
                  >
                    End Consult
                  </button>
                </div>
              </section>

              <section className="rx-card">
                <h3>E-Prescription Studio</h3>
                <div className="field">
                  <label htmlFor="drug">Drug Name</label>
                  <input
                    id="drug"
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    placeholder="Amoxicillin 500mg"
                  />
                </div>
                <div className="field">
                  <label htmlFor="dose">Dosage Instructions</label>
                  <input
                    id="dose"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="1 tab 3x daily after meals"
                  />
                </div>
                <div className="rx-row">
                  <div className="field">
                    <label htmlFor="duration">Duration</label>
                    <input
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="5 days"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="refills">Refills</label>
                    <input
                      id="refills"
                      type="number"
                      min={0}
                      max={12}
                      value={refills}
                      onChange={(e) => setRefills(Number(e.target.value))}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-issue"
                  type="button"
                  disabled={busy}
                  onClick={onIssueScript}
                >
                  {busy ? 'Issuing…' : 'ISSUE E-PRESCRIPTION'}
                </button>
              </section>

              <section className="rx-card">
                <h3>Patient Health Vault snapshot</h3>
                {vaultLoading && <div className="empty">Loading vault…</div>}
                {vault && (
                  <>
                    <div className="vital-grid drawer-vitals">
                      {vault.vitals.map((v) => (
                        <div key={v.id} className="vital">
                          <div className="label">{v.label}</div>
                          <div className="value">
                            {v.value}
                            <span style={{ fontSize: 12, marginLeft: 6 }}>{v.unit}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="drawer-rx-list">
                      {vault.records
                        .filter((r) => r.category === 'Pharmacy')
                        .slice(0, 4)
                        .map((r) => (
                          <div key={r.id} className="record">
                            <div className="title">{r.title}</div>
                            <div className="summary">
                              {r.prescribed_by || 'Clinician'} · {r.date_label}
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
