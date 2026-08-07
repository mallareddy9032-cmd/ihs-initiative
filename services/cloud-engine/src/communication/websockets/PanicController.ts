// ============================================================================
// FILE: src/communication/websockets/PanicController.ts
// CONTEXT: IHS Cloud Engine - Real-Time SOS & Dual-Pin Routing
// ============================================================================

import { WebSocket } from 'ws';
import { ihsDbClient } from '../../infrastructure/database/client';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { calculateHaversineDistance } from '../../utils/geo';
import { WebSocketEngine } from './WebSocketEngine';
import { AdminController } from './AdminController';
import { SmsService } from '../../services/sms.service';

interface PanicGps {
  lat: number;
  lng: number;
  accuracy_meters?: number;
}

interface PanicPayload {
  event: string;
  ihs_uid?: string;
  timestamp?: string;
  gps?: PanicGps;
  live_gps?: PanicGps;
  connection_type?: string;
}

export class PanicController {
  static handleIncomingConnection(ws: WebSocket): void {
    WebSocketEngine.attachSocketHeartbeat(ws);
    ws.on('message', async (rawMessage: Buffer | string) => {
      try {
        const message = typeof rawMessage === 'string' ? rawMessage : rawMessage.toString('utf8');
        const payload = JSON.parse(message) as PanicPayload;

        if (payload.event === 'PING' || (payload as { type?: string }).type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'PONG', timestamp: Date.now() }));
          }
          return;
        }

        if (payload.event === 'PANIC_TRIGGERED' || payload.event === 'PANIC_ALERT') {
          await PanicController.processEmergencySOS(
            { ...payload, event: 'PANIC_TRIGGERED' },
            ws,
          );
        }
      } catch (error) {
        console.error('Invalid WebSocket payload received', error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ error: 'INVALID_PAYLOAD' }));
        }
      }
    });
  }

  static async injectPanic(
    payload: PanicPayload,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const fakeWs = {
      readyState: WebSocket.OPEN,
      send: () => undefined,
    } as unknown as WebSocket;
    try {
      await PanicController.processEmergencySOS(payload, fakeWs);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'INJECT_FAILED',
      };
    }
  }

  private static async processEmergencySOS(payload: PanicPayload, clientSocket: WebSocket) {
    const ihs_uid = payload.ihs_uid;
    const gps = payload.gps ?? payload.live_gps;
    const timestamp = payload.timestamp ?? new Date().toISOString();

    if (!ihs_uid || !gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
      clientSocket.send(JSON.stringify({ error: 'MALFORMED_PANIC_PAYLOAD' }));
      return;
    }

    let patient: {
      internal_id: string;
      ihs_uid: string;
      first_name: string;
      last_name: string;
      home_lat: number;
      home_lng: number;
      is_proxy?: boolean;
    } | null = null;

    let patientPhone: string | null = null;

    if (isDemoMode()) {
      patient = DemoStore.findPatientByUid(ihs_uid) ?? null;
      patientPhone = '+919876543210';
    } else {
      const row = await ihsDbClient.patient.findUnique({
        where: { ihsUid: ihs_uid.toUpperCase() },
      });
      if (row) {
        patient = {
          internal_id: row.id,
          ihs_uid: row.ihsUid,
          first_name: row.firstName || row.name.split(' ')[0] || 'Patient',
          last_name: row.lastName || row.name.split(' ').slice(1).join(' ') || '',
          home_lat: row.homeLat,
          home_lng: row.homeLng,
        };
        patientPhone = row.phone;
      }
    }

    if (!patient) {
      clientSocket.send(JSON.stringify({ error: 'UNAUTHORIZED_IHS_UID' }));
      return;
    }

    const homeGps = { lat: patient.home_lat, lng: patient.home_lng };
    const distanceMeters = calculateHaversineDistance(homeGps, gps);

    let warningLevel: string | null = null;
    let actionRequired = 'STANDARD_DISPATCH';

    if (distanceMeters > 100) {
      warningLevel = 'AMBER_ALERT';
      actionRequired = 'DISPATCHER_VERIFICATION_REQUIRED';
    }

    let caseId: string | undefined;
    if (isDemoMode()) {
      caseId = DemoStore.createPanicCase(patient.internal_id, {
        live_lat: gps.lat,
        live_lng: gps.lng,
        chief_complaint: 'SOS Panic Trigger',
      }).case_id;
    } else {
      const incident = await ihsDbClient.emergencyIncident.create({
        data: {
          patientId: patient.internal_id,
          status: 'INITIATED',
          latitude: gps.lat,
          longitude: gps.lng,
          chiefComplaint: 'SOS Panic Trigger',
        },
      });
      await ihsDbClient.clinicalCase.create({
        data: {
          case_id: incident.id,
          patient_id: patient.internal_id,
          current_status: 'INITIATED',
        },
      });
      caseId = incident.id;
    }

    void SmsService.sendEmergencySosAlert({
      patientName: `${patient.first_name} ${patient.last_name}`,
      phone: patientPhone,
      time: new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      trackUrl: `http://localhost:3000/track${caseId ? `?case=${caseId}` : ''}`,
    });

    const dispatchAlert = {
      event: warningLevel ? 'DUAL_PIN_MISMATCH_ALERT' : 'INBOUND_EMERGENCY_SOS',
      payload: {
        ihs_uid: patient.ihs_uid,
        patient_name: `${patient.first_name} ${patient.last_name}`,
        patient_internal_id: patient.internal_id,
        case_id: caseId,
        is_proxy: !!patient.is_proxy,
        deviation_meters: distanceMeters,
        warning_level: warningLevel,
        action_required: actionRequired,
        live_gps: gps,
        home_gps: homeGps,
        timestamp,
        connection_type: payload.connection_type ?? 'WIFI_LTE',
      },
    };

    PanicController.broadcastToDispatchers(dispatchAlert);
    AdminController.onMirroredEvent(dispatchAlert);
    console.log(
      `[Panic] Broadcast ${dispatchAlert.event} for ${patient.ihs_uid} → ${WebSocketEngine.dispatcherCount()} dispatcher(s)`,
    );

    if (clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.send(
        JSON.stringify({
          event: 'PANIC_ACKNOWLEDGED',
          payload: {
            ihs_uid: patient.ihs_uid,
            case_id: caseId,
            deviation_meters: distanceMeters,
            warning_level: warningLevel,
          },
        }),
      );
    }
  }

  static registerDispatcher(ws: WebSocket): void {
    WebSocketEngine.registerDispatcher(ws);
    console.log('[Dispatch] Command Center console connected');

    ws.on('message', async (raw) => {
      try {
        const message = typeof raw === 'string' ? raw : raw.toString('utf8');
        const payload = JSON.parse(message) as {
          event?: string;
          case_id?: string;
          patient_id?: string;
          ihs_uid?: string;
          fleet_id?: string;
          stress_cycle?: number;
        };
        if (payload.event !== 'FLEET_DISPATCH' && payload.event !== 'DISPATCH_FLEET') return;
        if (!isDemoMode()) {
          ws.send(JSON.stringify({ error: 'DEMO_MODE_REQUIRED' }));
          return;
        }

        const ihsUid = String(payload.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
        const patient = DemoStore.findPatientByUid(ihsUid);
        if (!patient) {
          ws.send(JSON.stringify({ error: 'PATIENT_NOT_FOUND' }));
          return;
        }

        // Keep stress cycles from failing after quota exhaustion
        const sub = DemoStore.findSubscription(patient.internal_id);
        if (sub) sub.doorstep_visits_remaining = Math.max(sub.doorstep_visits_remaining, 3);

        let caseId = payload.case_id;
        let patientId = payload.patient_id || patient.internal_id;
        if (!caseId) {
          caseId = DemoStore.findLatestInitiatedCase(patientId)?.case_id;
        }
        if (!caseId) {
          caseId = DemoStore.createPanicCase(patientId, {
            chief_complaint: 'SOS Panic Trigger',
          }).case_id;
        }

        const { DriverController } = await import('./DriverController');
        const result = DemoStore.attemptDispatch(caseId, patientId, 'STRESS_TEST');
        if (!result.success) {
          ws.send(JSON.stringify({ error: 'DISPATCH_DENIED', ...result }));
          return;
        }

        const fleetId = (payload.fleet_id || result.fleet_id || 'AMB-VSKP-07').toUpperCase();
        result.case.assigned_fleet_id = fleetId;
        DriverController.pushAssignment(
          {
            case_id: caseId,
            fleet_id: fleetId,
            driver_name: 'Ravi Kumar',
            patient_name: `${patient.first_name} ${patient.last_name}`,
            ihs_uid: patient.ihs_uid,
            patient_internal_id: patientId,
            patient_age: 54,
            triage_priority: 'RED',
            chief_complaint: 'SOS Panic Trigger',
            stress_cycle: payload.stress_cycle,
            eta_minutes: 8,
            timestamp: new Date().toISOString(),
          },
          fleetId,
        );

        const ack = {
          event: 'FLEET_DISPATCH_ACK',
          payload: {
            case_id: caseId,
            fleet_id: fleetId,
            stress_cycle: payload.stress_cycle,
            timestamp: new Date().toISOString(),
          },
        };
        WebSocketEngine.broadcastToDispatchers(ack);
        WebSocketEngine.broadcastToAdmins(ack);
      } catch (error) {
        console.error('[Dispatch] FLEET_DISPATCH failed', error);
      }
    });
  }

  private static broadcastToDispatchers(data: unknown): void {
    WebSocketEngine.broadcastToDispatchers(data);
  }
}
