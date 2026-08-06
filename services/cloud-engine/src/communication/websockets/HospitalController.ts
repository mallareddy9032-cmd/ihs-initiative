// ============================================================================
// FILE: src/communication/websockets/HospitalController.ts
// CONTEXT: ER / Trauma Bay receiving stream + intake close-loop
// ============================================================================

import { WebSocket } from 'ws';
import { WebSocketEngine } from './WebSocketEngine';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { AdminController } from './AdminController';

function synthesizeVitals(priority: 'RED' | 'YELLOW' | 'GREEN') {
  if (priority === 'RED') {
    return { hr: 128, spo2: 89, bp_sys: 88, bp_dia: 54 };
  }
  if (priority === 'YELLOW') {
    return { hr: 104, spo2: 94, bp_sys: 132, bp_dia: 84 };
  }
  return { hr: 78, spo2: 98, bp_sys: 118, bp_dia: 76 };
}

function triageFromComplaint(complaint?: string): 'RED' | 'YELLOW' | 'GREEN' {
  const c = (complaint || '').toUpperCase();
  if (c.includes('SOS') || c.includes('PANIC') || c.includes('CARDIAC') || c.includes('TRAUMA')) {
    return 'RED';
  }
  if (c.includes('FALL') || c.includes('PAIN') || c.includes('RESP')) {
    return 'YELLOW';
  }
  return 'GREEN';
}

export class HospitalController {
  static handleConnection(ws: WebSocket): void {
    WebSocketEngine.registerHospital(ws);
    ws.send(
      JSON.stringify({
        event: 'HOSPITAL_CONNECTED',
        payload: {
          facility: 'KGH Visakhapatnam · ER / Trauma',
          message: 'Listening for inbound ambulance transports',
        },
      }),
    );
    console.log(`[Hospital] ER console connected · hospitals=${WebSocketEngine.hospitalCount()}`);

    ws.on('message', (raw) => {
      try {
        const message = typeof raw === 'string' ? raw : raw.toString('utf8');
        const payload = JSON.parse(message) as {
          event?: string;
          case_id?: string;
          bay_id?: string;
          er_doctor?: string;
          stress_cycle?: number;
        };
        if (payload.event !== 'BAY_RESERVED' || !payload.case_id || !isDemoMode()) return;
        const bayId = payload.bay_id || 'BAY-3';
        const doctor = payload.er_doctor || 'Dr. Meera Krishnan';
        const clinicalCase = DemoStore.reserveBay(payload.case_id, bayId, doctor);
        if (!clinicalCase) {
          ws.send(JSON.stringify({ error: 'CASE_NOT_FOUND' }));
          return;
        }
        const envelope = {
          event: 'BAY_RESERVED',
          payload: {
            case_id: payload.case_id,
            bay_id: bayId,
            er_doctor: doctor,
            fleet_id: clinicalCase.assigned_fleet_id,
            stress_cycle: payload.stress_cycle,
            timestamp: new Date().toISOString(),
          },
        };
        WebSocketEngine.broadcastToHospitals(envelope);
        WebSocketEngine.broadcastToDispatchers(envelope);
        WebSocketEngine.broadcastToAdmins(envelope);
      } catch (error) {
        console.error('[Hospital] Invalid payload', error);
      }
    });
  }

  /** Build rich ER feed payload from case + driver status. */
  static buildIncomingPayload(
    caseId: string,
    status: string,
    etaMinutes?: number,
    fleetId?: string,
  ): Record<string, unknown> | null {
    if (!isDemoMode()) return null;
    const packed = DemoStore.getCaseWithPatient(caseId);
    if (!packed) return null;
    const { clinicalCase, patient } = packed;
    const snap = clinicalCase.assignment_snapshot || {};
    const priority =
      clinicalCase.triage_priority ||
      triageFromComplaint(clinicalCase.chief_complaint) ||
      'RED';
    const vitals = synthesizeVitals(priority);
    const age = clinicalCase.patient_age ?? 54;

    return {
      case_id: caseId,
      fleet_id: fleetId || clinicalCase.assigned_fleet_id || snap.fleet_id,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      ihs_uid: patient.ihs_uid,
      patient_age: age,
      chief_complaint: clinicalCase.chief_complaint || 'SOS Panic Trigger',
      triage_priority: priority,
      driver_status: status,
      eta_minutes: typeof etaMinutes === 'number' ? etaMinutes : Number(snap.eta_minutes) || 8,
      vitals,
      live_gps: snap.live_gps || {
        lat: clinicalCase.live_lat ?? patient.home_lat,
        lng: clinicalCase.live_lng ?? patient.home_lng,
      },
      hospital_name: snap.hospital_name || 'KGH Visakhapatnam',
      reserved_bay: clinicalCase.reserved_bay || null,
      assigned_er_doctor: clinicalCase.assigned_er_doctor || null,
      timestamp: new Date().toISOString(),
    };
  }

  static notifyIncomingTransport(
    caseId: string,
    status: string,
    etaMinutes?: number,
    fleetId?: string,
  ): void {
    const payload = HospitalController.buildIncomingPayload(caseId, status, etaMinutes, fleetId);
    if (!payload) return;

    // ER cares most once transport / on-scene / handoff begins
    const notifyStatuses = new Set([
      'ACCEPTED',
      'EN_ROUTE_PATIENT',
      'ON_SCENE',
      'TRANSPORTING',
      'HANDOFF_COMPLETE',
    ]);
    if (!notifyStatuses.has(status)) return;

    const envelope = {
      event: 'INCOMING_TRANSPORT',
      payload,
    };
    WebSocketEngine.broadcastToHospitals(envelope);
    AdminController.onMirroredEvent(envelope);
  }

  static confirmIntake(input: {
    case_id: string;
    bay_id?: string;
    er_doctor?: string;
  }): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
    if (!isDemoMode()) {
      return { ok: false, error: 'DEMO_MODE_REQUIRED' };
    }
    const clinicalCase = DemoStore.confirmErIntake(input.case_id);
    if (!clinicalCase) {
      return { ok: false, error: 'CASE_NOT_FOUND' };
    }
    if (input.bay_id || input.er_doctor) {
      DemoStore.reserveBay(
        input.case_id,
        input.bay_id || clinicalCase.reserved_bay || 'BAY-2',
        input.er_doctor || clinicalCase.assigned_er_doctor || 'Dr. On-Duty',
      );
    }

    const packed = DemoStore.getCaseWithPatient(input.case_id);
    const payload = {
      case_id: input.case_id,
      fleet_id: clinicalCase.assigned_fleet_id,
      patient_name: packed
        ? `${packed.patient.first_name} ${packed.patient.last_name}`
        : 'IHS Member',
      ihs_uid: packed?.patient.ihs_uid,
      bay_id: clinicalCase.reserved_bay || input.bay_id || 'BAY-2',
      er_doctor: clinicalCase.assigned_er_doctor || input.er_doctor,
      status: 'ER_ADMITTED',
      label: 'ER INTAKE CONFIRMED',
      timestamp: new Date().toISOString(),
    };

    const envelope = { event: 'ER_INTAKE_CONFIRMED', payload };
    WebSocketEngine.broadcastEverywhere(envelope, {
      caseId: input.case_id,
      fleetId: clinicalCase.assigned_fleet_id,
    });
    AdminController.onMirroredEvent(envelope);

    console.log(`[Hospital] ER intake confirmed case=${input.case_id} bay=${payload.bay_id}`);
    return { ok: true, payload };
  }
}
