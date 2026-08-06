// ============================================================================
// FILE: src/communication/rest/ClinicalController.ts
// CONTEXT: Doctor console — appointments, vault, e-prescriptions
// ============================================================================

import { Request, Response } from 'express';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { WebSocketEngine } from '../websockets/WebSocketEngine';

export class ClinicalController {
  static listAppointments(_req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    return res.status(200).json({
      appointments: DemoStore.listAppointments(),
    });
  }

  static getPatientVault(req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.params.ihsUid || '').toUpperCase();
    const vault = DemoStore.getPatientVault(ihsUid);
    if (!vault) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }
    return res.status(200).json(vault);
  }

  static startConsult(req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const appointmentId = String(req.body?.appointment_id || '');
    const apt = DemoStore.updateAppointmentStatus(appointmentId, 'in_consult');
    if (!apt) {
      return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    }
    const envelope = { event: 'CONSULT_STARTED', payload: apt };
    WebSocketEngine.broadcastToDoctors(envelope);
    WebSocketEngine.broadcastToPatient(apt.ihs_uid, envelope);
    return res.status(200).json({ success: true, appointment: apt });
  }

  static endConsult(req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const appointmentId = String(req.body?.appointment_id || '');
    const apt = DemoStore.updateAppointmentStatus(appointmentId, 'completed');
    if (!apt) {
      return res.status(404).json({ error: 'APPOINTMENT_NOT_FOUND' });
    }
    const envelope = { event: 'CONSULT_ENDED', payload: apt };
    WebSocketEngine.broadcastToDoctors(envelope);
    WebSocketEngine.broadcastToPatient(apt.ihs_uid, envelope);
    return res.status(200).json({ success: true, appointment: apt });
  }

  static issuePrescription(req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }

    const ihsUid = String(
      req.body?.patient_id || req.body?.ihs_uid || '',
    ).toUpperCase();
    const prescribedBy = String(
      req.body?.physician || req.body?.prescribed_by || 'Dr. Ananya Rao',
    );
    const instructions = req.body?.instructions ? String(req.body.instructions) : undefined;
    const title = req.body?.title ? String(req.body.title) : undefined;
    const appointmentId = req.body?.appointment_id
      ? String(req.body.appointment_id)
      : undefined;
    const timestamp = new Date().toISOString();

    /** Accept either medicines[] or flat single-drug fields from the doctor drawer */
    let medicines = Array.isArray(req.body?.medicines) ? req.body.medicines : [];
    if (!medicines.length && (req.body?.drug_name || req.body?.medication?.name)) {
      const med = req.body?.medication || {};
      medicines = [
        {
          name: req.body?.drug_name || med.name,
          dose: req.body?.dosage || req.body?.dosage_instructions || med.dose,
          duration: req.body?.duration || med.duration,
          quantity: req.body?.quantity || med.quantity || 10,
          refills: req.body?.refills ?? med.refills ?? 0,
        },
      ];
    }

    if (!ihsUid || !medicines.length) {
      return res.status(400).json({ error: 'MISSING_IHS_UID_OR_MEDICINES' });
    }

    const normalized = medicines.map(
      (m: {
        name?: string;
        dose?: string;
        duration?: string;
        quantity?: number;
        refills?: number;
      }) => ({
        name: String(m.name || 'Medication'),
        dose: String(m.dose || ''),
        duration: String(m.duration || ''),
        quantity: Number(m.quantity) || 1,
        refills: Number(m.refills) || 0,
      }),
    );

    const record = DemoStore.issuePrescription({
      ihs_uid: ihsUid,
      prescribed_by: prescribedBy,
      title,
      medicines: normalized,
      instructions,
    });
    if (!record) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }

    if (appointmentId) {
      DemoStore.updateAppointmentStatus(appointmentId, 'completed');
    }

    const primary = normalized[0];
    const envelope = {
      event: 'PRESCRIPTION_ISSUED' as const,
      payload: {
        id: record.id,
        patient_id: record.ihs_uid,
        ihs_uid: record.ihs_uid,
        title: record.title,
        category: record.category,
        dateLabel: record.date_label,
        wormLocked: record.worm_locked,
        summary: record.summary,
        prescribedBy: record.prescribed_by,
        physician: prescribedBy,
        timestamp,
        medication: {
          name: primary.name,
          dose: primary.dose,
          duration: primary.duration,
          quantity: primary.quantity,
          refills: primary.refills ?? 0,
        },
        medicines: record.medicines,
        refills: primary.refills ?? 0,
        instructions: instructions || record.summary,
      },
    };

    WebSocketEngine.broadcastToPatient(ihsUid, envelope);
    WebSocketEngine.broadcastToDoctors(envelope);

    return res.status(201).json({ success: true, prescription: envelope.payload });
  }

  /** Patient app can mirror a local booking into the clinician queue */
  static queueAppointment(req: Request, res: Response) {
    if (!isDemoMode()) {
      return res.status(503).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.body?.ihs_uid || '').toUpperCase();
    const patient = DemoStore.findPatientByUid(ihsUid);
    if (!patient) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }
    const type = req.body?.type === 'home_visit' ? 'home_visit' : 'teleconsult';
    const apt = DemoStore.queueAppointment({
      ihs_uid: ihsUid,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      type,
      title: type === 'home_visit' ? 'GP Home Visit' : 'Teleconsult',
      clinician: String(req.body?.clinician || 'Dr. Ananya Rao'),
      when_label: String(req.body?.when_label || 'Today · ASAP'),
      when_iso: String(req.body?.when_iso || new Date().toISOString()),
      capitation_status: 'COVERED',
      notes: req.body?.notes ? String(req.body.notes) : undefined,
    });
    const envelope = { event: 'APPOINTMENT_QUEUED', payload: apt };
    WebSocketEngine.broadcastToDoctors(envelope);
    return res.status(201).json({ success: true, appointment: apt });
  }
}
