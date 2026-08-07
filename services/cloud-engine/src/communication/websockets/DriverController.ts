// ============================================================================
// FILE: src/communication/websockets/DriverController.ts
// CONTEXT: Ambulance driver stream — assignments in, trip status out
// ============================================================================

import { WebSocket } from 'ws';
import { WebSocketEngine } from './WebSocketEngine';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { HospitalController } from './HospitalController';
import { AdminController } from './AdminController';
import { DispatchAckWatchdog } from '../../services/DispatchAckWatchdog';

export type DriverTripStatus =
  | 'ACCEPTED'
  | 'EN_ROUTE_PATIENT'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'HANDOFF_COMPLETE';

interface DriverInbound {
  event?: string;
  fleet_id?: string;
  case_id?: string;
  status?: DriverTripStatus;
  driver_gps?: { lat: number; lng: number };
  eta_minutes?: number;
  label?: string;
}

const STATUS_LABEL: Record<DriverTripStatus, string> = {
  ACCEPTED: 'ACCEPT DISPATCH',
  EN_ROUTE_PATIENT: 'EN ROUTE TO PATIENT',
  ON_SCENE: 'ARRIVED ON SCENE',
  TRANSPORTING: 'TRANSPORTING TO HOSPITAL',
  HANDOFF_COMPLETE: 'PATIENT HANDOFF COMPLETE',
};

export class DriverController {
  static handleConnection(ws: WebSocket, fleetId: string): void {
    const normalized = (fleetId || 'AMB-VSKP-07').toUpperCase();
    WebSocketEngine.registerDriver(ws, normalized);

    ws.send(
      JSON.stringify({
        event: 'DRIVER_CONNECTED',
        payload: {
          fleet_id: normalized,
          message: 'Listening for dispatch assignments',
        },
      }),
    );

    console.log(`[Driver] Connected fleet=${normalized} · drivers=${WebSocketEngine.driverCount()}`);

    ws.on('message', (raw) => {
      try {
        const message = typeof raw === 'string' ? raw : raw.toString('utf8');
        const payload = JSON.parse(message) as DriverInbound & {
          event?: string;
          stress_cycle?: number;
          lat?: number;
          lng?: number;
        };
        if (payload.event === 'DRIVER_STATUS_UPDATE') {
          DriverController.handleStatusUpdate(payload, normalized);
          return;
        }
        if (payload.event === 'PING' || payload.event === 'PONG') {
          return;
        }
        if (payload.event === 'LOCATION_TELEMETRY') {
          const gps = payload.driver_gps || {
            lat: typeof payload.lat === 'number' ? payload.lat : 17.73,
            lng: typeof payload.lng === 'number' ? payload.lng : 83.3,
          };
          const envelope = {
            event: 'LOCATION_TELEMETRY',
            payload: {
              case_id: payload.case_id,
              fleet_id: (payload.fleet_id || normalized).toUpperCase(),
              driver_gps: gps,
              stress_cycle: payload.stress_cycle,
              timestamp: new Date().toISOString(),
            },
          };
          WebSocketEngine.broadcastToDispatchers(envelope);
          WebSocketEngine.broadcastToHospitals(envelope);
          WebSocketEngine.broadcastToAdmins(envelope);
          if (payload.case_id) {
            WebSocketEngine.broadcastToCase(payload.case_id, envelope);
          }
          AdminController.onMirroredEvent({
            event: 'DRIVER_STATUS_UPDATE',
            payload: envelope.payload,
          });
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'LOCATION_TELEMETRY_ACK', payload: envelope.payload }));
          }
        }
      } catch (error) {
        console.error('[Driver] Invalid payload', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
        }
      }
    });
  }

  static handleStatusUpdate(payload: DriverInbound, fallbackFleet: string): void {
    const status = payload.status;
    if (!status || !STATUS_LABEL[status]) {
      return;
    }

    const caseId = payload.case_id;
    const fleetId = (payload.fleet_id || fallbackFleet).toUpperCase();
    const envelope = {
      event: 'DRIVER_STATUS_UPDATE',
      payload: {
        case_id: caseId,
        fleet_id: fleetId,
        status,
        label: payload.label || STATUS_LABEL[status],
        driver_gps: payload.driver_gps,
        eta_minutes: payload.eta_minutes,
        timestamp: new Date().toISOString(),
      },
    };

    if (isDemoMode() && caseId) {
      DemoStore.updateCaseDriverStatus(caseId, status, fleetId);
    }
    if (caseId) {
      DispatchAckWatchdog.acknowledge(caseId, status);
    }

    WebSocketEngine.broadcastToDispatchers(envelope);
    if (caseId) {
      WebSocketEngine.broadcastToCase(caseId, envelope);
      HospitalController.notifyIncomingTransport(
        caseId,
        status,
        payload.eta_minutes,
        fleetId,
      );
    }
    AdminController.onMirroredEvent(envelope);

    console.log(`[Driver] ${fleetId} → ${status}${caseId ? ` case=${caseId}` : ''}`);
  }

  /** Push a job to the assigned (or all) driver sockets. */
  static pushAssignment(assignment: Record<string, unknown>, fleetId: string): void {
    const enriched: Record<string, unknown> = {
      ...assignment,
      patient_age: typeof assignment.patient_age === 'number' ? assignment.patient_age : 54,
      triage_priority:
        typeof assignment.triage_priority === 'string' ? assignment.triage_priority : 'RED',
    };
    const envelope = {
      event: 'DISPATCH_ASSIGNMENT',
      payload: enriched,
    };
    WebSocketEngine.broadcastToDrivers(envelope, fleetId);
    WebSocketEngine.broadcastToDispatchers({
      event: 'FLEET_ASSIGNMENT_PUSHED',
      payload: enriched,
    });
    const caseId = typeof enriched.case_id === 'string' ? enriched.case_id : null;
    if (caseId) {
      if (isDemoMode()) {
        DemoStore.saveAssignmentSnapshot(caseId, enriched);
      }
      WebSocketEngine.broadcastToCase(caseId, {
        event: 'AMBULANCE_DISPATCHED',
        payload: enriched,
      });
      // Pre-alert ER that a unit is mobilized
      HospitalController.notifyIncomingTransport(
        caseId,
        'ACCEPTED',
        typeof enriched.eta_minutes === 'number' ? enriched.eta_minutes : 8,
        fleetId,
      );
    }
    AdminController.onMirroredEvent({ event: 'FLEET_ASSIGNMENT_PUSHED', payload: enriched });
    console.log(
      `[Driver] Assignment pushed fleet=${fleetId} → ${WebSocketEngine.driverCount()} driver socket(s)`,
    );
  }
}
