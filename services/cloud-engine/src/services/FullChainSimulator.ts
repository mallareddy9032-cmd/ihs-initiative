// ============================================================================
// FILE: src/services/FullChainSimulator.ts
// CONTEXT: Orchestrated demo — SOS → Dispatch → Driver → ER intake
// ============================================================================

import { PanicController } from '../communication/websockets/PanicController';
import { DriverController } from '../communication/websockets/DriverController';
import { HospitalController } from '../communication/websockets/HospitalController';
import { DemoStore, isDemoMode } from '../infrastructure/demo/DemoStore';
import { WebSocketEngine } from '../communication/websockets/WebSocketEngine';
import { AdminController } from '../communication/websockets/AdminController';
import { calculateHaversineDistance } from '../utils/geo';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STAGING = {
  lat: 17.734,
  lng: 83.306,
  driver: 'Ravi Kumar',
  hospital: 'KGH Visakhapatnam',
};

let running = false;

function progress(
  step: number,
  total: number,
  status: 'running' | 'complete' | 'error',
  message: string,
  extra?: Record<string, unknown>,
) {
  const envelope = {
    event: 'SIMULATION_PROGRESS',
    payload: {
      step,
      total,
      status,
      message,
      timestamp: new Date().toISOString(),
      ...extra,
    },
  };
  WebSocketEngine.broadcastToAdmins(envelope);
  WebSocketEngine.broadcastToDispatchers(envelope);
  WebSocketEngine.broadcastToHospitals(envelope);
  AdminController.pushSnapshot();
}

export class FullChainSimulator {
  static isRunning(): boolean {
    return running;
  }

  /** Acquire lock and kick off cascade (non-blocking). */
  static begin(opts?: {
    ihs_uid?: string;
    fleet_id?: string;
    bay_id?: string;
    er_doctor?: string;
  }): { ok: true } | { ok: false; error: string } {
    if (!isDemoMode()) {
      return { ok: false, error: 'DEMO_MODE_REQUIRED' };
    }
    if (running) {
      return { ok: false, error: 'SIMULATION_ALREADY_RUNNING' };
    }
    running = true;
    void FullChainSimulator.execute(opts).finally(() => {
      running = false;
    });
    return { ok: true };
  }

  private static async execute(opts?: {
    ihs_uid?: string;
    fleet_id?: string;
    bay_id?: string;
    er_doctor?: string;
  }): Promise<{ ok: true; case_id?: string } | { ok: false; error: string }> {
    const ihsUid = (opts?.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
    const fleetId = (opts?.fleet_id || 'AMB-VSKP-07').toUpperCase();
    const bayId = opts?.bay_id || 'BAY-3';
    const doctor = opts?.er_doctor || 'Dr. Meera Krishnan';
    let caseId: string | undefined;

    try {
      const patient = DemoStore.findPatientByUid(ihsUid);
      if (!patient) {
        progress(1, 4, 'error', 'Patient not found');
        return { ok: false, error: 'PATIENT_NOT_FOUND' };
      }

      // Ensure demo quota does not block repeated chain runs
      const sub = DemoStore.findSubscription(patient.internal_id);
      if (sub && sub.doorstep_visits_remaining < 1) {
        sub.doorstep_visits_remaining = 3;
      }

      // —— Step 1 (0s): Panic SOS (offset GPS → Amber dual-pin) ——
      progress(1, 4, 'running', 'Step 1/4: Triggering Panic SOS for Ramu SuperAdmin…');
      const live = {
        lat: patient.home_lat + 0.0035,
        lng: patient.home_lng + 0.0025,
      };
      const panic = await PanicController.injectPanic({
        event: 'PANIC_TRIGGERED',
        ihs_uid: ihsUid,
        timestamp: new Date().toISOString(),
        gps: live,
        connection_type: 'FULL_CHAIN_SIM',
      });
      if (!panic.ok) {
        progress(1, 4, 'error', `SOS failed: ${panic.error}`);
        return { ok: false, error: panic.error };
      }
      const initiated = DemoStore.findLatestInitiatedCase(patient.internal_id);
      caseId = initiated?.case_id;
      progress(1, 4, 'complete', 'Step 1/4 Complete: SOS Triggered (Amber dual-pin)', {
        case_id: caseId,
        ihs_uid: ihsUid,
      });

      await sleep(1000);

      // —— Step 2 (1s): Dispatch AMB-VSKP-07 with Amber verification ——
      progress(2, 4, 'running', 'Step 2/4: Mobilizing AMB-VSKP-07 (Ravi Kumar)…');
      if (!caseId) {
        progress(2, 4, 'error', 'No case available for dispatch');
        return { ok: false, error: 'CASE_CREATE_FAILED' };
      }

      const result = DemoStore.attemptDispatch(caseId, patient.internal_id, 'PHONE_VERIFIED');
      if (!result.success) {
        progress(2, 4, 'error', 'Dispatch blocked — quota exceeded');
        return { ok: false, error: 'QUOTA_EXCEEDED' };
      }

      result.case.assigned_fleet_id = fleetId;
      const liveGps = {
        lat: result.case.live_lat ?? live.lat,
        lng: result.case.live_lng ?? live.lng,
      };
      const homeGps = { lat: patient.home_lat, lng: patient.home_lng };
      const distanceKm =
        Math.round((calculateHaversineDistance(STAGING, liveGps) / 1000) * 10) / 10;
      const etaMinutes = Math.max(4, Math.round(distanceKm * 2.8));

      DriverController.pushAssignment(
        {
          case_id: result.case.case_id,
          fleet_id: fleetId,
          driver_name: STAGING.driver,
          patient_name: `${patient.first_name} ${patient.last_name}`,
          ihs_uid: patient.ihs_uid,
          patient_internal_id: patient.internal_id,
          patient_age: 54,
          triage_priority: 'RED',
          chief_complaint: result.case.chief_complaint ?? 'SOS Panic Trigger',
          live_gps: liveGps,
          home_gps: homeGps,
          driver_gps: { lat: STAGING.lat, lng: STAGING.lng },
          hospital_name: STAGING.hospital,
          distance_km: distanceKm,
          eta_minutes: etaMinutes,
          override_reason: 'PHONE_VERIFIED',
          timestamp: new Date().toISOString(),
        },
        fleetId,
      );

      progress(2, 4, 'complete', 'Step 2/4 Complete: Unit Mobilized with Amber verification', {
        case_id: caseId,
        fleet_id: fleetId,
        driver: 'Ravi Kumar',
        override_reason: 'PHONE_VERIFIED',
      });

      await sleep(1000);

      // —— Step 3 (2s): ACCEPTED → EN ROUTE → TRANSPORTING ——
      progress(3, 4, 'running', 'Step 3/4: Advancing driver trip pipeline…');
      const statuses = [
        { status: 'ACCEPTED' as const, label: 'ACCEPT DISPATCH' },
        { status: 'EN_ROUTE_PATIENT' as const, label: 'EN ROUTE TO PATIENT' },
        { status: 'TRANSPORTING' as const, label: 'TRANSPORTING TO HOSPITAL' },
      ];
      for (const s of statuses) {
        DriverController.handleStatusUpdate(
          {
            event: 'DRIVER_STATUS_UPDATE',
            case_id: caseId,
            fleet_id: fleetId,
            status: s.status,
            label: s.label,
            eta_minutes: s.status === 'TRANSPORTING' ? 5 : 8,
          },
          fleetId,
        );
        await sleep(280);
      }
      progress(3, 4, 'complete', 'Step 3/4 Complete: Driver ACCEPTED → EN ROUTE → TRANSPORTING', {
        case_id: caseId,
        fleet_id: fleetId,
      });

      await sleep(1000);

      // —— Step 4 (3s): Reserve Bay 3 + Confirm ER Intake ——
      progress(4, 4, 'running', 'Step 4/4: Allocating Trauma Bay 3 · Confirming ER intake…');
      DemoStore.reserveBay(caseId, bayId, doctor);
      const bayEnvelope = {
        event: 'BAY_RESERVED',
        payload: {
          case_id: caseId,
          bay_id: bayId,
          er_doctor: doctor,
          fleet_id: fleetId,
          timestamp: new Date().toISOString(),
        },
      };
      WebSocketEngine.broadcastToHospitals(bayEnvelope);
      WebSocketEngine.broadcastToDispatchers(bayEnvelope);

      const intake = HospitalController.confirmIntake({
        case_id: caseId,
        bay_id: bayId,
        er_doctor: doctor,
      });
      if (!intake.ok) {
        progress(4, 4, 'error', `ER intake failed: ${intake.error}`);
        return { ok: false, error: intake.error };
      }

      progress(4, 4, 'complete', 'Step 4/4 Complete: Trauma Bay 3 · ER Intake Confirmed', {
        case_id: caseId,
        bay_id: bayId,
        er_doctor: doctor,
      });

      WebSocketEngine.broadcastToAdmins({
        event: 'SIMULATION_COMPLETE',
        payload: {
          case_id: caseId,
          message: 'Full emergency chain simulation finished',
          steps: 4,
        },
      });
      AdminController.pushSnapshot();

      return { ok: true, case_id: caseId };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'SIMULATION_FAILED';
      progress(0, 4, 'error', msg);
      return { ok: false, error: msg };
    }
  }
}
