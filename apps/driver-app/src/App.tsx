import { useEffect, useMemo, useState } from 'react';
import { DriverMap } from './components/DriverMap';
import { IncomingDispatchModal } from './components/IncomingDispatchModal';
import { useDriverSocket } from './hooks/useDriverSocket';
import { googleMapsNavUrl } from './lib/geo';
import {
  DEMO_ASSIGNMENT,
  DRIVER_PROFILE,
  GGH_ANANTHAPUR,
  TRIP_PIPELINE,
  type TripStep,
  type VitalsLog,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const DISPATCH_TEL = 'tel:+919032600410';

const STEP_INDEX: Record<TripStep, number> = {
  ACKNOWLEDGE: 0,
  EN_ROUTE: 1,
  ON_SCENE: 2,
  PATIENT_LOADED: 3,
  TRANSPORTING: 4,
  COMPLETE: 5,
};

const DEFAULT_VITALS: VitalsLog = {
  hr: 118,
  spo2: 94,
  bpSys: 148,
  bpDia: 92,
  note: 'Oxygen initiated @ 4L/min',
  locked: false,
};

export default function App() {
  const {
    connectionState,
    assignment,
    setAssignment,
    clearAssignment,
    error,
    toast,
    setToast,
    sendStatus,
  } = useDriverSocket(DRIVER_PROFILE.fleetId);

  const [step, setStep] = useState<TripStep>('ACKNOWLEDGE');
  const [modalOpen, setModalOpen] = useState(true);
  const [busyDemo, setBusyDemo] = useState(false);
  const [onDuty, setOnDuty] = useState(true);
  const [etaSeconds, setEtaSeconds] = useState(4 * 60 + 12);
  const [onSceneSeconds, setOnSceneSeconds] = useState(0);
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number } | null>(null);
  const [vitals, setVitals] = useState<VitalsLog>(DEFAULT_VITALS);
  const [erAck, setErAck] = useState(false);

  const activeJob = assignment;
  const showModal = !!activeJob && modalOpen && step === 'ACKNOWLEDGE';

  const mapDriver = driverGps || activeJob?.driver_gps || { lat: 14.6819, lng: 77.6006 };
  const mapPatient = activeJob?.live_gps || { lat: 14.6842, lng: 77.6051 };
  const hospital = GGH_ANANTHAPUR;

  const nextAction = useMemo(() => {
    return TRIP_PIPELINE.find((s) => s.step === step) ?? null;
  }, [step]);

  const phase: 'to_patient' | 'to_hospital' =
    step === 'TRANSPORTING' || step === 'COMPLETE' || step === 'PATIENT_LOADED'
      ? 'to_hospital'
      : 'to_patient';

  useEffect(() => {
    if (!activeJob) return;
    if (step === 'EN_ROUTE' || step === 'ACKNOWLEDGE') {
      const id = window.setInterval(() => {
        setEtaSeconds((s) => Math.max(0, s - 1));
      }, 1000);
      return () => window.clearInterval(id);
    }
    return undefined;
  }, [activeJob, step]);

  useEffect(() => {
    if (step !== 'ON_SCENE' && step !== 'PATIENT_LOADED') return;
    const id = window.setInterval(() => setOnSceneSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const etaLabel = useMemo(() => {
    const m = Math.floor(etaSeconds / 60);
    const s = etaSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [etaSeconds]);

  const advanceTrip = () => {
    if (!activeJob || !nextAction) return;

    sendStatus({
      event: 'DRIVER_STATUS_UPDATE',
      fleet_id: DRIVER_PROFILE.fleetId,
      case_id: activeJob.case_id,
      status: nextAction.statusEvent,
      label: nextAction.label,
      driver_gps: mapDriver,
      eta_minutes: Math.ceil(etaSeconds / 60),
    });

    if (nextAction.step === 'ACKNOWLEDGE') {
      setModalOpen(false);
      setStep('EN_ROUTE');
      setDriverGps(activeJob.driver_gps);
      setToast('Dispatch acknowledged — Desk #04 notified');
      return;
    }

    if (nextAction.step === 'EN_ROUTE') {
      setStep('ON_SCENE');
      setToast('EN ROUTE — patient ETA tracking live');
      setDriverGps({
        lat: (mapDriver.lat + mapPatient.lat) / 2,
        lng: (mapDriver.lng + mapPatient.lng) / 2,
      });
      return;
    }

    if (nextAction.step === 'ON_SCENE') {
      setStep('PATIENT_LOADED');
      setDriverGps(mapPatient);
      setOnSceneSeconds(0);
      setToast('ARRIVED ON SCENE — triage timer started');
      return;
    }

    if (nextAction.step === 'PATIENT_LOADED') {
      setStep('TRANSPORTING');
      setVitals((v) => ({ ...v, locked: true }));
      setToast('PATIENT LOADED — pre-arrival vitals locked');
      return;
    }

    if (nextAction.step === 'TRANSPORTING') {
      setStep('COMPLETE');
      setErAck(true);
      setDriverGps({
        lat: (mapPatient.lat + hospital.lat) / 2,
        lng: (mapPatient.lng + hospital.lng) / 2,
      });
      setToast('TRANSPORTING — GGH Trauma Bay notified');
      return;
    }

    if (nextAction.step === 'COMPLETE') {
      setToast('TRIP COMPLETED — unit Available');
      setDriverGps(hospital);
      window.setTimeout(() => {
        clearAssignment();
        setStep('ACKNOWLEDGE');
        setModalOpen(true);
        setDriverGps(null);
        setEtaSeconds(4 * 60 + 12);
        setOnSceneSeconds(0);
        setVitals(DEFAULT_VITALS);
        setErAck(false);
      }, 2400);
    }
  };

  const requestDemoJob = async () => {
    setBusyDemo(true);
    try {
      const res = await fetch(`${API_BASE}/v1/demo/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ihs_uid: 'IHS-8802',
          fleet_id: DRIVER_PROFILE.fleetId,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        assignment?: typeof activeJob;
      };
      if (!res.ok) throw new Error(body.error || 'Demo assign failed');
      if (body.assignment) {
        setAssignment({
          ...DEMO_ASSIGNMENT,
          ...body.assignment,
          hospital_name: body.assignment.hospital_name || DEMO_ASSIGNMENT.hospital_name,
          hospital_bay: DEMO_ASSIGNMENT.hospital_bay,
          er_doctor: DEMO_ASSIGNMENT.er_doctor,
          sector: DEMO_ASSIGNMENT.sector,
        });
      } else {
        setAssignment({ ...DEMO_ASSIGNMENT, timestamp: new Date().toISOString() });
      }
      setStep('ACKNOWLEDGE');
      setModalOpen(true);
      setEtaSeconds(4 * 60 + 12);
      setVitals(DEFAULT_VITALS);
      setErAck(false);
      setToast('Demo emergency assigned');
    } catch {
      setAssignment({ ...DEMO_ASSIGNMENT, timestamp: new Date().toISOString() });
      setStep('ACKNOWLEDGE');
      setModalOpen(true);
      setEtaSeconds(4 * 60 + 12);
      setVitals(DEFAULT_VITALS);
      setErAck(false);
      setToast('Local demo dispatch loaded');
    } finally {
      setBusyDemo(false);
    }
  };

  const navDest =
    phase === 'to_hospital' ? hospital : activeJob?.live_gps || mapPatient;

  const bumpVital = (key: keyof Pick<VitalsLog, 'hr' | 'spo2' | 'bpSys' | 'bpDia'>, delta: number) => {
    if (vitals.locked) return;
    setVitals((v) => ({ ...v, [key]: Math.max(0, Number(v[key]) + delta) }));
  };

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* A. Header */}
      <header className="topbar">
        <div className="identity">
          <div className="serif brand-title">Driver HUD</div>
          <strong>
            {DRIVER_PROFILE.name} · Unit {DRIVER_PROFILE.vehicleReg}
          </strong>
          <span>{DRIVER_PROFILE.vehicle}</span>
        </div>
        <div className="gps-lock">
          <span className="pulse-dot" />
          GPS LOCKED · {DRIVER_PROFILE.sector.toUpperCase()}
        </div>
        <div className="header-actions">
          <a className="icon-pill ios-press" href={DISPATCH_TEL}>
            📞
          </a>
          <button
            type="button"
            className={`duty-pill ios-press ${onDuty ? 'on' : 'off'}`}
            onClick={() => setOnDuty((v) => !v)}
          >
            {onDuty ? '🟢 ON DUTY' : '⚪ OFF DUTY'}
          </button>
        </div>
      </header>

      <div className="conn-row">
        <span className={`status-pill ${connectionState}`}>{connectionState.toUpperCase()}</span>
        {error && <span className="err-inline">{error}</span>}
      </div>

      {/* B. Active dispatch callout */}
      {activeJob && (
        <section className="dispatch-banner dark-card">
          <div className="banner-top">
            <div>
              <div className="eyebrow">ACTIVE DISPATCH</div>
              <h2 className="serif">
                {activeJob.patient_name} · {activeJob.ihs_uid}
              </h2>
              <p className="complaint">{activeJob.chief_complaint}</p>
              <p className="sector">
                {activeJob.sector || 'Ananthapur Urban · Sector 04'}
              </p>
            </div>
            <div className="eta-block">
              <div className="eta-label">TARGET ETA</div>
              <div className={`eta-value ${etaSeconds < 60 ? 'critical' : ''}`}>{etaLabel}</div>
              <div className="eta-sub">sub-5 min goal</div>
            </div>
          </div>
          <a
            className="btn btn-amber nav-cta ios-press"
            href={googleMapsNavUrl(navDest)}
            target="_blank"
            rel="noreferrer"
          >
            🗺️ Launch Turn-by-Turn GPS Navigation
          </a>
        </section>
      )}

      {/* D. Map */}
      <DriverMap
        driver={mapDriver}
        patient={mapPatient}
        hospital={hospital}
        phase={phase}
      />

      <section className="panel">
        {!activeJob && (
          <div className="standby dark-card">
            <h2 className="serif">Standby</h2>
            <p>
              Listening for Command Center mobilize on {DRIVER_PROFILE.fleetId}. When an SOS is
              assigned, the priority dispatch modal appears.
            </p>
            <button
              type="button"
              className="btn btn-amber ios-press"
              disabled={busyDemo || !onDuty}
              onClick={() => void requestDemoJob()}
            >
              {busyDemo ? 'REQUESTING…' : 'REQUEST DEMO EMERGENCY'}
            </button>
          </div>
        )}

        {activeJob && (
          <>
            {/* C. Lifecycle action bar */}
            <div className="lifecycle">
              <h3 className="serif section-h">Trip Lifecycle</h3>
              <div className="steps-rail">
                {TRIP_PIPELINE.map((s, i) => {
                  const current = STEP_INDEX[step];
                  const done = i < current;
                  const active = i === current;
                  return (
                    <div
                      key={s.step}
                      className={`step-chip ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              {nextAction && (
                <button
                  type="button"
                  className={`btn trip-btn ios-press ${
                    step === 'ACKNOWLEDGE' ? 'btn-danger' : 'btn-primary'
                  }`}
                  onClick={advanceTrip}
                >
                  {nextAction.label}
                </button>
              )}
              {(step === 'ON_SCENE' || step === 'PATIENT_LOADED') && (
                <div className="scene-timer">
                  On-scene triage · {Math.floor(onSceneSeconds / 60)}:
                  {String(onSceneSeconds % 60).padStart(2, '0')}
                </div>
              )}
            </div>

            {/* E. Vitals logger */}
            <div className="vitals-card dark-card">
              <h3 className="serif section-h">Pre-Arrival Stream</h3>
              <p className="muted">
                Stream live vitals to Hospital ER
                {vitals.locked ? ' · LOCKED' : ''}
              </p>
              <div className="vital-pads">
                <div className="vital-pad">
                  <span>Heart Rate</span>
                  <strong>{vitals.hr}</strong>
                  <em>BPM</em>
                  <div className="pad-btns">
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('hr', -2)}>
                      −
                    </button>
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('hr', 2)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="vital-pad">
                  <span>SpO₂</span>
                  <strong>{vitals.spo2}</strong>
                  <em>%</em>
                  <div className="pad-btns">
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('spo2', -1)}>
                      −
                    </button>
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('spo2', 1)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="vital-pad">
                  <span>BP Sys</span>
                  <strong>{vitals.bpSys}</strong>
                  <em>mmHg</em>
                  <div className="pad-btns">
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('bpSys', -2)}>
                      −
                    </button>
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('bpSys', 2)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="vital-pad">
                  <span>BP Dia</span>
                  <strong>{vitals.bpDia}</strong>
                  <em>mmHg</em>
                  <div className="pad-btns">
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('bpDia', -2)}>
                      −
                    </button>
                    <button type="button" className="ios-press" disabled={vitals.locked} onClick={() => bumpVital('bpDia', 2)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
              <label className="note-field">
                Primary Care Note
                <input
                  value={vitals.note}
                  disabled={vitals.locked}
                  onChange={(e) => setVitals((v) => ({ ...v, note: e.target.value }))}
                />
              </label>
              {!vitals.locked && (
                <button
                  type="button"
                  className="btn btn-ghost ios-press"
                  onClick={() => {
                    setToast('Vitals pushed to ER pre-arrival stream');
                    sendStatus({
                      event: 'PRE_ARRIVAL_VITALS',
                      fleet_id: DRIVER_PROFILE.fleetId,
                      case_id: activeJob.case_id,
                      vitals,
                    });
                  }}
                >
                  Push vitals to ER
                </button>
              )}
            </div>

            {/* F. Hospital pre-notification */}
            <div className="er-card dark-card">
              <h3 className="serif section-h">Destination Hospital</h3>
              <div className="er-grid">
                <div>
                  <span>Facility</span>
                  <strong>{activeJob.hospital_name || 'GGH Ananthapuramu'}</strong>
                </div>
                <div>
                  <span>Trauma Bay</span>
                  <strong>{activeJob.hospital_bay || 'Trauma Bay T-03'}</strong>
                </div>
                <div>
                  <span>Receiving ER</span>
                  <strong>{activeJob.er_doctor || 'Dr. Meera A.'}</strong>
                </div>
                <div>
                  <span>Pre-notification</span>
                  <strong className={erAck || step === 'TRANSPORTING' || step === 'COMPLETE' ? 'ack' : ''}>
                    {erAck || step === 'TRANSPORTING' || step === 'COMPLETE'
                      ? '● ACKNOWLEDGED'
                      : '○ PENDING'}
                  </strong>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {showModal && activeJob && (
        <IncomingDispatchModal
          job={activeJob}
          onAccept={advanceTrip}
          onDismiss={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
