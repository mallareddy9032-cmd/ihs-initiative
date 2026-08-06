// ============================================================================
// FILE: src/communication/websockets/DoctorController.ts
// CONTEXT: Clinician console realtime channel
// ============================================================================

import { WebSocket } from 'ws';
import { WebSocketEngine } from './WebSocketEngine';
import { DemoStore } from '../../infrastructure/demo/DemoStore';

export class DoctorController {
  static handleConnection(ws: WebSocket): void {
    WebSocketEngine.registerDoctor(ws);
    ws.send(
      JSON.stringify({
        event: 'DOCTOR_CONNECTED',
        payload: {
          message: 'Clinician channel open',
          appointments: DemoStore.listAppointments('queued'),
        },
      }),
    );
    console.log(`[Doctor] Console connected · doctors=${WebSocketEngine.doctorCount()}`);

    ws.on('message', (raw) => {
      try {
        const message = typeof raw === 'string' ? raw : raw.toString('utf8');
        const payload = JSON.parse(message) as {
          event?: string;
          patient_id?: string;
          ihs_uid?: string;
          physician?: string;
          drug_name?: string;
          dosage?: string;
          duration?: string;
          stress_cycle?: number;
        };
        if (payload.event !== 'PRESCRIPTION_ISSUED' && payload.event !== 'ISSUE_PRESCRIPTION') {
          return;
        }
        const ihsUid = String(payload.patient_id || payload.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
        const physician = payload.physician || 'Dr. Ananya Rao';
        const drug = payload.drug_name || 'Azithromycin 500mg';
        const dose = payload.dosage || '1 tab once daily';
        const duration = payload.duration || '3 days';
        const record = DemoStore.issuePrescription({
          ihs_uid: ihsUid,
          prescribed_by: physician,
          title: `E-Prescription — ${drug}`,
          instructions: `${dose} · ${duration}`,
          medicines: [
            { name: drug, dose, duration, quantity: 3, refills: 0 },
          ],
        });
        if (!record) {
          ws.send(JSON.stringify({ error: 'PATIENT_NOT_FOUND' }));
          return;
        }
        const envelope = {
          event: 'PRESCRIPTION_ISSUED',
          payload: {
            id: record.id,
            patient_id: ihsUid,
            ihs_uid: ihsUid,
            title: record.title,
            category: 'Pharmacy',
            dateLabel: record.date_label,
            wormLocked: true,
            summary: record.summary,
            prescribedBy: physician,
            physician,
            timestamp: new Date().toISOString(),
            medication: { name: drug, dose, duration, quantity: 3, refills: 0 },
            medicines: record.medicines,
            stress_cycle: payload.stress_cycle,
          },
        };
        WebSocketEngine.broadcastToPatient(ihsUid, envelope);
        WebSocketEngine.broadcastToDoctors(envelope);
        WebSocketEngine.broadcastToAdmins(envelope);
      } catch (error) {
        console.error('[Doctor] Invalid payload', error);
      }
    });
  }

  static handlePatientConnection(ws: WebSocket, ihsUid: string): void {
    const uid = (ihsUid || 'IHS-ADMIN-00001').toUpperCase();
    WebSocketEngine.registerPatient(ws, uid);
    ws.send(
      JSON.stringify({
        event: 'PATIENT_CONNECTED',
        payload: { ihs_uid: uid, message: 'Listening for e-prescriptions & consult updates' },
      }),
    );
    console.log(`[Patient] Stream connected uid=${uid}`);
  }
}
