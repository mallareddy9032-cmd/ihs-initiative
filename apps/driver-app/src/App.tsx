import { useMemo, useState } from 'react';
import { DriverMap } from './components/DriverMap';
import { IncomingDispatchModal } from './components/IncomingDispatchModal';
import { useDriverSocket } from './hooks/useDriverSocket';
import { googleMapsNavUrl, wazeNavUrl } from './lib/geo';
import { TRIP_PIPELINE, type TripStep } from './types';

const FLEET_ID = 'AMB-VSKP-07';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const STEP_INDEX: Record<TripStep, number> = {
  ACCEPT: 0,
  EN_ROUTE: 1,
  ON_SCENE: 2,
  TRANSPORTING: 3,
  HANDOFF: 4,
  COMPLETE: 5,
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
  } = useDriverSocket(FLEET_ID);

  const [step, setStep] = useState<TripStep>('ACCEPT');
  const [modalOpen, setModalOpen] = useState(true);
  const [busyDemo, setBusyDemo] = useState(false);
  const [driverGps, setDriverGps] = useState<{ lat: number; lng: number } | null>(null);

  const activeJob = assignment;
  const showModal = !!activeJob && modalOpen && step === 'ACCEPT';

  const mapDriver = driverGps || activeJob?.driver_gps || { lat: 17.734, lng: 83.306 };
  const mapPatient = activeJob?.live_gps || { lat: 17.7231, lng: 83.3012 };

  const nextAction = useMemo(() => {
    const idx = STEP_INDEX[step];
    if (idx >= TRIP_PIPELINE.length) return null;
    return TRIP_PIPELINE[idx];
  }, [step]);

  const advanceTrip = () => {
    if (!activeJob || !nextAction) return;

    const ok = sendStatus({
      event: 'DRIVER_STATUS_UPDATE',
      fleet_id: FLEET_ID,
      case_id: activeJob.case_id,
      status: nextAction.statusEvent,
      label: nextAction.label,
      driver_gps: mapDriver,
      eta_minutes: activeJob.eta_minutes,
    });

    if (!ok) return;

    if (nextAction.step === 'ACCEPT') {
      setModalOpen(false);
      setStep('EN_ROUTE');
      setDriverGps(activeJob.driver_gps);
      setToast('Dispatch accepted — en route');
      return;
    }

    if (nextAction.step === 'EN_ROUTE') {
      setStep('ON_SCENE');
      setToast('Status: EN ROUTE TO PATIENT');
      // Nudge pin toward patient for visual feedback
      setDriverGps({
        lat: (mapDriver.lat + mapPatient.lat) / 2,
        lng: (mapDriver.lng + mapPatient.lng) / 2,
      });
      return;
    }

    if (nextAction.step === 'ON_SCENE') {
      setStep('TRANSPORTING');
      setDriverGps(mapPatient);
      setToast('Status: ARRIVED ON SCENE');
      return;
    }

    if (nextAction.step === 'TRANSPORTING') {
      setStep('HANDOFF');
      setToast('Status: TRANSPORTING TO HOSPITAL');
      return;
    }

    if (nextAction.step === 'HANDOFF') {
      setStep('COMPLETE');
      setToast('Patient handoff complete');
      window.setTimeout(() => {
        clearAssignment();
        setStep('ACCEPT');
        setModalOpen(true);
        setDriverGps(null);
      }, 2200);
    }
  };

  const requestDemoJob = async () => {
    setBusyDemo(true);
    try {
      const res = await fetch(`${API_BASE}/v1/demo/assign-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihs_uid: 'IHS-ADMIN-00001', fleet_id: FLEET_ID }),
      });
      const body = (await res.json()) as { error?: string; assignment?: typeof activeJob };
      if (!res.ok) {
        throw new Error(body.error || 'Demo assign failed');
      }
      if (body.assignment) {
        setAssignment(body.assignment);
        setStep('ACCEPT');
        setModalOpen(true);
        setDriverGps(body.assignment.driver_gps);
      }
      setToast('Demo job assigned');
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'Demo failed');
    } finally {
      setBusyDemo(false);
    }
  };

  const dest =
    step === 'TRANSPORTING' || step === 'HANDOFF'
      ? activeJob?.home_gps || mapPatient
      : mapPatient;

  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      <header className="topbar">
        <div className="brand">IHS DRIVER</div>
        <div className="fleet-meta">
          <strong>{FLEET_ID}</strong>
          <span>Ravi Kumar · ALS</span>
        </div>
        <div className={`status-pill dot ${connectionState}`}>{connectionState.toUpperCase()}</div>
      </header>

      {error && (
        <div style={{ background: 'rgba(255,45,85,0.12)', color: '#FF2D55', padding: '8px 14px', fontSize: 12 }}>{error}</div>
      )}

      <DriverMap driver={mapDriver} patient={mapPatient} />

      <section className="panel">
        {!activeJob && (
          <div className="standby">
            <h2>STANDBY</h2>
            <p>
              Listening on driver stream for fleet {FLEET_ID}. When Command Center mobilizes this
              unit, a priority dispatch modal will appear.
            </p>
            <button
              type="button"
              className="btn btn-amber"
              style={{ width: '100%', marginTop: 14 }}
              disabled={busyDemo}
              onClick={() => void requestDemoJob()}
            >
              {busyDemo ? 'REQUESTING…' : 'REQUEST DEMO JOB'}
            </button>
          </div>
        )}

        {activeJob && (
          <>
            <div className="job-card">
              <h3>{activeJob.patient_name}</h3>
              <div className="meta">
                <div>
                  Medical ID: <strong>{activeJob.ihs_uid}</strong>
                </div>
                <div>
                  Trigger: <strong>{activeJob.chief_complaint}</strong>
                </div>
                <div>
                  Distance / ETA:{' '}
                  <strong>
                    {activeJob.distance_km.toFixed(1)} km · {activeJob.eta_minutes} min
                  </strong>
                </div>
                <div>
                  Case: <strong>{activeJob.case_id.slice(0, 8)}…</strong>
                </div>
              </div>
            </div>

            <div className="nav-row">
              <a
                className="btn btn-secondary"
                style={{ textDecoration: 'none', textAlign: 'center', display: 'grid', placeItems: 'center' }}
                href={googleMapsNavUrl(dest)}
                target="_blank"
                rel="noreferrer"
              >
                Google Maps
              </a>
              <a
                className="btn btn-secondary"
                style={{ textDecoration: 'none', textAlign: 'center', display: 'grid', placeItems: 'center' }}
                href={wazeNavUrl(dest)}
                target="_blank"
                rel="noreferrer"
              >
                Waze
              </a>
            </div>

            {step !== 'COMPLETE' && nextAction && (
              <button
                type="button"
                className={`btn trip-btn ${step === 'ACCEPT' ? 'btn-danger' : 'btn-primary'}`}
                onClick={advanceTrip}
              >
                {nextAction.label}
              </button>
            )}

            {step === 'COMPLETE' && (
              <div className="standby">
                <h2>TRIP COMPLETE</h2>
                <p>Handoff broadcast to dispatcher + patient tracker.</p>
              </div>
            )}
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
