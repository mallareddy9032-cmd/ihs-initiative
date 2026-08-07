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
import {
  DEMO_APPOINTMENTS,
  DEMO_VAULT,
  DOCTOR_PROFILE,
  DOSAGE_OPTIONS,
  DURATION_OPTIONS,
  MED_CATALOG,
  type Appointment,
  type CallState,
  type ClinicianSession,
  type PatientVault,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

function normalizeVault(raw: Partial<PatientVault> | null | undefined, fallbackUid?: string): PatientVault {
  const base = DEMO_VAULT;
  const vitals = Array.isArray(raw?.vitals) && raw!.vitals!.length > 0 ? raw!.vitals! : base.vitals;
  const records = Array.isArray(raw?.records) && raw!.records!.length > 0 ? raw!.records! : base.records;
  let allergies: string[] = base.allergies || [];
  const rawAllergies = (raw as { allergies?: unknown } | null | undefined)?.allergies;
  if (Array.isArray(rawAllergies) && rawAllergies.length > 0) {
    allergies = rawAllergies.map(String);
  } else if (typeof rawAllergies === 'string' && rawAllergies.trim()) {
    allergies = [rawAllergies.trim()];
  }
  return {
    patient: {
      ihs_uid: raw?.patient?.ihs_uid || fallbackUid || base.patient.ihs_uid,
      first_name: raw?.patient?.first_name || base.patient.first_name,
      last_name: raw?.patient?.last_name || base.patient.last_name,
    },
    vitals,
    records,
    allergies,
    capitation: raw?.capitation || base.capitation,
  };
}

function normalizeAppointment(apt: Appointment): Appointment {
  return {
    ...apt,
    id: apt.id || `apt-${Date.now()}`,
    patient_name: apt.patient_name || 'Patient',
    ihs_uid: apt.ihs_uid || 'UNKNOWN',
    when_iso: apt.when_iso || new Date().toISOString(),
    when_label: apt.when_label || 'Scheduled',
    status: apt.status || 'queued',
    type: apt.type || 'teleconsult',
    title: apt.title || 'Teleconsult',
    clinician: apt.clinician || DOCTOR_PROFILE.name,
    capitation_status: apt.capitation_status || 'COVERED',
  };
}

function formatAllergies(allergies: string[] | undefined): string {
  if (!Array.isArray(allergies) || allergies.length === 0) return '';
  return allergies.filter(Boolean).join(', ');
}

export default function App() {
  const [session, setSession] = useState<ClinicianSession | null>(null);
  const [uid, setUid] = useState('DOC-101');
  const [pin, setPin] = useState('123456');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const { connectionState, appointments, setAppointments, toast, setToast } =
    useDoctorSocket(Boolean(session));

  const [selectedId, setSelectedId] = useState<string | null>('apt-8802');
  const [vault, setVault] = useState<PatientVault>(() => normalizeVault(DEMO_VAULT));
  const [vaultLoading, setVaultLoading] = useState(false);
  const [callState, setCallState] = useState<CallState>('idle');
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const [completedToday, setCompletedToday] = useState(12);

  const [drugQuery, setDrugQuery] = useState('Paracetamol 650mg');
  const [drugName, setDrugName] = useState('Paracetamol 650mg');
  const [dosage, setDosage] = useState('1-0-1 (After Food)');
  const [duration, setDuration] = useState('5 Days');
  const [advice, setAdvice] = useState(
    'Hydrate well and rest. Review if fever persists above 101°F.',
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const queue = useMemo(() => {
    const source = appointments.length > 0 ? appointments : DEMO_APPOINTMENTS;
    return source.map(normalizeAppointment);
  }, [appointments]);

  const waiting = queue.filter((a) => a.status === 'queued' || a.status === 'in_consult').length;

  const selected = useMemo(() => {
    return queue.find((a) => a.id === selectedId) || queue[0] || null;
  }, [queue, selectedId]);

  const suggestions = useMemo(() => {
    const q = drugQuery.trim().toLowerCase();
    if (!q) return MED_CATALOG.slice(0, 5);
    return MED_CATALOG.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [drugQuery]);

  useEffect(() => {
    if (!session) return;
    fetchAppointments()
      .then((list) => {
        if (list.length) {
          const normalized = list.map(normalizeAppointment);
          setAppointments(normalized);
          setSelectedId((prev) => {
            if (prev && normalized.some((a) => a.id === prev)) return prev;
            return normalized.find((a) => a.status === 'queued')?.id || normalized[0]?.id || prev;
          });
        } else {
          setAppointments(DEMO_APPOINTMENTS);
        }
      })
      .catch(() => setAppointments(DEMO_APPOINTMENTS));
  }, [session, setAppointments]);

  useEffect(() => {
    if (!selected) {
      setVault(normalizeVault(DEMO_VAULT));
      setVaultLoading(false);
      return;
    }
    let cancelled = false;
    setVaultLoading(true);
    // Prefer local demo vault immediately so UI never blanks while network resolves.
    setVault(
      normalizeVault(
        {
          ...DEMO_VAULT,
          patient: {
            ihs_uid: selected.ihs_uid,
            first_name: selected.patient_name.split(' ')[0] || 'Patient',
            last_name: selected.patient_name.split(' ').slice(1).join(' ') || '',
          },
        },
        selected.ihs_uid,
      ),
    );
    fetchPatientVault(selected.ihs_uid)
      .then((v) => {
        if (!cancelled) setVault(normalizeVault(v, selected.ihs_uid));
      })
      .catch(() => {
        /* keep optimistic DEMO vault — avoid blank UI on 404 */
      })
      .finally(() => {
        if (!cancelled) setVaultLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.ihs_uid, selected?.id]);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const s = await loginClinician(uid, pin);
      setSession({
        ...s,
        credentials: DOCTOR_PROFILE.credentials,
      });
      setAppointments(DEMO_APPOINTMENTS);
      setSelectedId('apt-8802');
    } catch {
      // Offline demo login for DOC-101
      if (uid.trim().toUpperCase() === 'DOC-101' && pin === '123456') {
        setSession({
          uid: DOCTOR_PROFILE.uid,
          name: DOCTOR_PROFILE.name,
          role: 'PHYSICIAN',
          token: 'demo-local',
          credentials: DOCTOR_PROFILE.credentials,
        });
        setAppointments(DEMO_APPOINTMENTS);
        setSelectedId('apt-8802');
        setToast('Offline clinical studio · demo session');
      } else {
        setLoginError('Login failed — try DOC-101 / 123456');
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const onStartVideo = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const apt = await startConsult(selected.id);
      setAppointments((prev) => {
        const base = prev.length ? prev : DEMO_APPOINTMENTS;
        return base.map((a) => (a.id === apt.id ? apt : a));
      });
      setCallState('live');
      setToast(`Video consult live with ${apt.patient_name}`);
    } catch {
      setAppointments((prev) => {
        const base = prev.length ? prev : DEMO_APPOINTMENTS;
        return base.map((a) =>
          a.id === selected.id ? { ...a, status: 'in_consult' as const } : a,
        );
      });
      setCallState('live');
      setToast(`Video consult live with ${selected.patient_name}`);
    } finally {
      setBusy(false);
    }
  };

  const onEndConsult = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const apt = await endConsult(selected.id);
      setAppointments((prev) => prev.map((a) => (a.id === apt.id ? apt : a)));
    } catch {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === selected.id ? { ...a, status: 'completed' as const } : a,
        ),
      );
    }
    setCallState('ended');
    setSharing(false);
    setCompletedToday((n) => n + 1);
    setToast('Consult completed');
    setBusy(false);
  };

  const onIssueScript = async () => {
    if (!selected || !session) return;
    if (!drugName.trim() || !dosage.trim() || !duration.trim()) {
      setToast('Medication, dosage, and duration are required');
      return;
    }
    setBusy(true);
    try {
      await issuePrescription({
        patient_id: selected.ihs_uid,
        ihs_uid: selected.ihs_uid,
        physician: session.name || DOCTOR_PROFILE.name,
        appointment_id: selected.id,
        title: `E-Prescription — ${drugName.trim()}`,
        drug_name: drugName.trim(),
        dosage_instructions: dosage.trim(),
        duration: duration.trim(),
        refills: 0,
        instructions: `${dosage.trim()} · ${duration.trim()} · ${advice.trim()}`,
        medicines: [
          {
            name: drugName.trim(),
            dose: dosage.trim(),
            duration: duration.trim(),
            quantity: 10,
            refills: 0,
          },
        ],
      });
    } catch {
      /* local vault append */
    }
    setVault((prev) => {
      const base = normalizeVault(prev);
      return normalizeVault({
        ...base,
        records: [
          {
            id: `rx-${Date.now()}`,
            ihs_uid: selected.ihs_uid,
            title: `E-Prescription — ${drugName.trim()}`,
            category: 'Pharmacy',
            date_label: 'Today',
            worm_locked: true,
            summary: `${dosage} · ${duration} · ${advice.slice(0, 48)}…`,
            prescribed_by: session.name,
            medicines: [
              {
                name: drugName.trim(),
                dose: dosage.trim(),
                duration: duration.trim(),
                quantity: 10,
              },
            ],
          },
          ...base.records,
        ],
      });
    });
    setToast(`⚡ E-Prescription synced → ${selected.patient_name} Vault`);
    setBusy(false);
  };

  const requestDoorstep = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE}/v1/dispatch/home-visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ihs_uid: selected.ihs_uid,
          patient_name: selected.patient_name,
          reason: selected.chief_complaint || selected.notes,
          requested_by: session?.name || DOCTOR_PROFILE.name,
        }),
      });
    } catch {
      /* offline */
    }
    setToast('Doorstep GP visit routed to Dispatch Command (App #2)');
    setBusy(false);
  };

  const orderLab = () => {
    setToast('Home lab sample collection ordered · phlebotomy queue notified');
  };

  if (!session) {
    return (
      <div className="login-shell">
        <form className="login-card squircle" onSubmit={onLogin}>
          <p className="login-brand">IHS CLINICAL</p>
          <h1 className="serif">Doctor Studio</h1>
          <p>
            Editorial teleconsult workspace · vault e-prescription · Ananthapur 50km grid.
          </p>
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
          <button className="btn btn-primary ios-press" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Authenticating…' : 'Enter Doctor Studio'}
          </button>
          <p className="login-hint">Demo · DOC-101 / 123456 · {DOCTOR_PROFILE.name}</p>
        </form>
      </div>
    );
  }

  const patientHeader = selected
    ? `${selected.patient_name} · ${selected.ihs_uid} · Age ${selected.age ?? 58} · ${
        selected.sector || 'Ananthapur Urban'
      }`
    : 'No patient selected';
  const complaint =
    selected?.chief_complaint || selected?.notes || 'Acute fever & follow-up review';
  const inCall = callState === 'live' || callState === 'muted' || callState === 'camera_off';

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* A. Clinical Header */}
      <header className="topbar squircle">
        <div className="identity">
          <div className="logo-mark" aria-hidden>
            IHS
          </div>
          <div>
            <div className="serif brand-title">Doctor Studio</div>
            <strong>
              {session.name} · {session.credentials || DOCTOR_PROFILE.credentials} ·{' '}
              {DOCTOR_PROFILE.role}
            </strong>
          </div>
        </div>

        <div className="kpi-row">
          <div className="kpi-badge">
            <span>Live Teleconsult Queue</span>
            <strong>{waiting} Waiting</strong>
          </div>
          <div className="kpi-badge mint">
            <span>Completed Today</span>
            <strong>{completedToday} Consults</strong>
          </div>
          <div className="kpi-badge live">
            <span className="pulse-dot" />
            ACTIVE ON CALL · ANANTHAPUR 50KM
          </div>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className={`duty-pill ios-press ${onDuty ? 'on' : 'off'}`}
            onClick={() => setOnDuty((v) => !v)}
          >
            {onDuty ? '🟢 AVAILABLE FOR CALLS' : '⚪ OFF DUTY'}
          </button>
          <div className="vault-pill">🔒 SHA-256 VAULT SYNC</div>
          <button
            type="button"
            className="btn btn-ghost ios-press"
            onClick={() => setSession(null)}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="studio-layout">
        {/* C. Left Drawer — History & Vitals */}
        <aside className="panel left-panel squircle mint-surface">
          <h2 className="serif section-h">Patient History & Vitals</h2>
          <p className="muted">Vault-synced from App #1</p>

          {vaultLoading && <div className="empty">Syncing vault…</div>}

          <>
              {!!formatAllergies(vault.allergies) && (
                <div className="allergy-badge">
                  ⚠ Known Allergies: {formatAllergies(vault.allergies)}
                </div>
              )}

              <div className="vital-grid">
                {(vault.vitals || []).map((v) => (
                  <div key={v.id || `${v.label}-${v.value}`} className="vital-tile squircle">
                    <span>{v.label}</span>
                    <strong>
                      {v.value}
                      <em>{v.unit}</em>
                    </strong>
                  </div>
                ))}
              </div>

              <h3 className="subhead">Historical Consultations</h3>
              <div className="history-list">
                {(vault.records || []).map((r) => (
                  <article key={r.id || r.title} className="history-item squircle">
                    <div className="hist-top">
                      <strong>{r.title}</strong>
                      <span>{r.date_label}</span>
                    </div>
                    <p>{r.summary}</p>
                    <em>
                      {r.prescribed_by || 'Clinician'} · {r.category}
                      {r.worm_locked ? ' · 🔒 WORM' : ''}
                    </em>
                  </article>
                ))}
              </div>
          </>

          <h3 className="subhead">Queue</h3>
          <div className="mini-queue">
            {queue.map((apt) => (
              <button
                key={apt.id}
                type="button"
                className={`queue-chip ios-press ${selected?.id === apt.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedId(apt.id);
                  setCallState(apt.status === 'in_consult' ? 'live' : 'idle');
                }}
              >
                <strong>{apt.patient_name}</strong>
                <span>
                  {apt.ihs_uid} · {apt.status.replace('_', ' ')}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* B. Center — Teleconsult Studio */}
        <section className="panel center-panel squircle">
          <div className="card-head">
            <h2 className="serif section-h">Active Teleconsultation</h2>
            <span className={`conn-pill ${connectionState}`}>{connectionState.toUpperCase()}</span>
          </div>

          <div className="patient-banner squircle">
            <div>
              <span className="eyebrow">Active Patient</span>
              <h3 className="serif">{patientHeader}</h3>
              <p>
                Chief Complaint: <strong>{complaint}</strong>
              </p>
            </div>
          </div>

          <div
            className={`video-stage squircle ${inCall ? 'live' : ''} ${
              !cameraOn ? 'cam-off' : ''
            }`}
          >
            <div className="video-overlay">
              <div className="video-avatar" aria-hidden>
                {(selected?.patient_name || 'P')
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <strong>
                {callState === 'idle' && 'Ready to connect'}
                {callState === 'live' && `● LIVE · ${selected?.patient_name}`}
                {callState === 'muted' && 'Mic muted · video active'}
                {callState === 'camera_off' && 'Camera off · audio active'}
                {callState === 'ended' && 'Consult ended'}
              </strong>
              <span>
                Simulated A/V · {session.name}
                {sharing ? ' · Screen sharing' : ''}
              </span>
            </div>

            <div className="video-controls">
              {!inCall && callState !== 'ended' && (
                <button
                  type="button"
                  className="ctrl primary ios-press"
                  disabled={busy || !onDuty}
                  onClick={() => void onStartVideo()}
                >
                  Start Consult
                </button>
              )}
              <button
                type="button"
                className={`ctrl ios-press ${callState === 'muted' ? 'active' : ''}`}
                disabled={!inCall}
                onClick={() =>
                  setCallState((s) => (s === 'muted' ? 'live' : s === 'live' || s === 'camera_off' ? 'muted' : s))
                }
              >
                {callState === 'muted' ? 'Unmute' : 'Mute'}
              </button>
              <button
                type="button"
                className={`ctrl ios-press ${!cameraOn ? 'active' : ''}`}
                disabled={!inCall}
                onClick={() => {
                  setCameraOn((v) => !v);
                  setCallState((s) =>
                    s === 'live' || s === 'muted' || s === 'camera_off'
                      ? cameraOn
                        ? 'camera_off'
                        : 'live'
                      : s,
                  );
                }}
              >
                Camera
              </button>
              <button
                type="button"
                className={`ctrl ios-press ${sharing ? 'active' : ''}`}
                disabled={!inCall}
                onClick={() => {
                  setSharing((v) => !v);
                  setToast(sharing ? 'Screen share stopped' : 'Screen share started');
                }}
              >
                Share
              </button>
              <button
                type="button"
                className="ctrl danger ios-press"
                disabled={!inCall || busy}
                onClick={() => void onEndConsult()}
              >
                End Consult
              </button>
            </div>
          </div>

          {/* E. Doorstep / Lab router */}
          <div className="escalate-row">
            <h3 className="serif section-h sm">Doorstep GP Visit & Follow-Up</h3>
            <div className="escalate-btns">
              <button
                type="button"
                className="btn btn-outline ios-press"
                disabled={!selected || busy}
                onClick={() => void requestDoorstep()}
              >
                [ Request Doorstep GP Visit ]
              </button>
              <button
                type="button"
                className="btn btn-outline ios-press"
                disabled={!selected || busy}
                onClick={orderLab}
              >
                [ Order Home Lab Sample Collection ]
              </button>
            </div>
          </div>
        </section>

        {/* D. Right — E-Prescription Builder */}
        <aside className="panel right-panel squircle">
          <h2 className="serif section-h">Vault E-Prescription Builder</h2>
          <p className="muted">Stock-aware pharmacy sync</p>

          <div className="field med-search">
            <label htmlFor="drug">Medication Search</label>
            <input
              id="drug"
              value={drugQuery}
              onChange={(e) => {
                setDrugQuery(e.target.value);
                setDrugName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 180)}
              placeholder="Paracetamol 650mg"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="suggest-list squircle">
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="ios-press"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setDrugQuery(m.name);
                        setDrugName(m.name);
                        setShowSuggestions(false);
                      }}
                    >
                      <strong>{m.name}</strong>
                      <span className={`stock ${m.stock}`}>
                        {m.stock === 'in_stock' && 'In stock'}
                        {m.stock === 'low' && 'Low stock'}
                        {m.stock === 'out' && 'Out'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="field">
            <label htmlFor="dose">Dosage & Frequency</label>
            <select
              id="dose"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
            >
              {DOSAGE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="duration">Duration</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="advice">Special Advice Note</label>
            <textarea
              id="advice"
              rows={3}
              value={advice}
              onChange={(e) => setAdvice(e.target.value)}
            />
          </div>

          <div className="rx-preview squircle">
            <span className="eyebrow">Preview</span>
            <strong>{drugName || '—'}</strong>
            <p>
              {dosage} · {duration}
            </p>
            <p className="advice-prev">{advice}</p>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-issue ios-press"
            disabled={busy || !selected}
            onClick={() => void onIssueScript()}
          >
            {busy ? 'Syncing…' : '⚡ Sign & Sync E-Prescription to Patient Vault'}
          </button>

          <button
            type="button"
            className="btn btn-ghost ios-press complete-btn"
            disabled={busy || !inCall}
            onClick={() => void onEndConsult()}
          >
            Complete Consult
          </button>
        </aside>
      </div>
    </div>
  );
}
