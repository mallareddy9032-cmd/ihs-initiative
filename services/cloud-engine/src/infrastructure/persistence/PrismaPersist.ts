// ============================================================================
// FILE: src/infrastructure/persistence/PrismaPersist.ts
// CONTEXT: Fire-and-forget Prisma dual-write from DemoStore + seed helpers
// ============================================================================

import { ihsDbClient } from '../database/client';

function logPersistError(op: string, error: unknown) {
  console.warn(`[PrismaPersist] ${op} failed:`, error instanceof Error ? error.message : error);
}

type PersistPatient = {
  internal_id: string;
  ihs_uid: string;
  first_name: string;
  last_name: string;
  home_lat: number;
  home_lng: number;
  phone?: string;
  emergencyContact?: string;
  capitationStatus?: string;
};

type PersistOperator = {
  operator_id: string;
  ihs_uid: string;
  full_name: string;
  hashed_pin: string;
  role: string;
  status: string;
};

type PersistCase = {
  case_id: string;
  patient_id: string;
  current_status: string;
  is_locked: boolean;
  assigned_fleet_id?: string;
  t_a?: string;
  live_lat?: number;
  live_lng?: number;
  chief_complaint?: string;
  driver_status?: string;
  assignment_snapshot?: Record<string, unknown>;
  reserved_bay?: string;
  assigned_er_doctor?: string;
  triage_priority?: string;
  patient_age?: number;
};

type PersistAppointment = {
  id: string;
  type: string;
  when_iso: string;
  status: string;
  title: string;
  clinician: string;
  when_label: string;
  capitation_status: string;
  notes?: string;
};

type PersistVaultRecord = {
  id: string;
  title: string;
  summary: string;
  prescribed_by?: string;
  medicines?: Array<{ name: string; dose: string; duration: string; refills?: number }>;
};

export class PrismaPersist {
  static async upsertPatient(p: PersistPatient): Promise<void> {
    try {
      const existing = await ihsDbClient.patient.findUnique({ where: { ihsUid: p.ihs_uid } });
      if (existing && existing.id !== p.internal_id) {
        // Align DB primary key with DemoStore stable IDs
        await ihsDbClient.appointment.deleteMany({ where: { patientId: existing.id } });
        await ihsDbClient.ePrescription.deleteMany({ where: { patientId: existing.id } });
        await ihsDbClient.emergencyIncident.deleteMany({ where: { patientId: existing.id } });
        await ihsDbClient.traumaBay.updateMany({
          where: { patientId: existing.id },
          data: { patientId: null, isOccupied: false },
        });
        await ihsDbClient.subscription.deleteMany({ where: { patientId: existing.id } });
        await ihsDbClient.patient.delete({ where: { id: existing.id } });
      }

      await ihsDbClient.patient.upsert({
        where: { ihsUid: p.ihs_uid },
        create: {
          id: p.internal_id,
          ihsUid: p.ihs_uid,
          name: `${p.first_name} ${p.last_name}`.trim(),
          firstName: p.first_name,
          lastName: p.last_name,
          phone: p.phone || '+919876543210',
          emergencyContact: p.emergencyContact || '+919000000001',
          capitationStatus: p.capitationStatus || 'ACTIVE',
          homeLat: p.home_lat,
          homeLng: p.home_lng,
        },
        update: {
          name: `${p.first_name} ${p.last_name}`.trim(),
          firstName: p.first_name,
          lastName: p.last_name,
          homeLat: p.home_lat,
          homeLng: p.home_lng,
          capitationStatus: p.capitationStatus || 'ACTIVE',
          phone: p.phone || undefined,
          emergencyContact: p.emergencyContact || undefined,
        },
      });
    } catch (error) {
      logPersistError('upsertPatient', error);
    }
  }

  static async upsertOperator(op: PersistOperator): Promise<void> {
    try {
      await ihsDbClient.operator.upsert({
        where: { ihsUid: op.ihs_uid },
        create: {
          id: op.operator_id,
          ihsUid: op.ihs_uid,
          fullName: op.full_name,
          hashedPin: op.hashed_pin,
          role: op.role,
          status: op.status,
        },
        update: {
          fullName: op.full_name,
          hashedPin: op.hashed_pin,
          role: op.role,
          status: op.status,
        },
      });
    } catch (error) {
      logPersistError('upsertOperator', error);
    }
  }

  static async upsertFleet(input: {
    vehicleNumber: string;
    driverName: string;
    status?: string;
    fuelLevel?: number;
    standbyPhone?: string;
  }): Promise<void> {
    try {
      await ihsDbClient.fleetUnit.upsert({
        where: { vehicleNumber: input.vehicleNumber },
        create: {
          vehicleNumber: input.vehicleNumber,
          driverName: input.driverName,
          status: input.status || 'AVAILABLE',
          fuelLevel: input.fuelLevel ?? 82,
          standbyPhone: input.standbyPhone || process.env.DEMO_ALERT_PHONE || '+919876500007',
        },
        update: {
          driverName: input.driverName,
          status: input.status || 'AVAILABLE',
          fuelLevel: input.fuelLevel ?? 82,
          standbyPhone: input.standbyPhone || undefined,
        },
      });
    } catch (error) {
      logPersistError('upsertFleet', error);
    }
  }

  static async upsertTraumaBay(input: {
    bayName: string;
    isOccupied?: boolean;
    assignedDoctor?: string | null;
    patientId?: string | null;
  }): Promise<void> {
    try {
      await ihsDbClient.traumaBay.upsert({
        where: { bayName: input.bayName },
        create: {
          bayName: input.bayName,
          isOccupied: !!input.isOccupied,
          assignedDoctor: input.assignedDoctor || null,
          patientId: input.patientId || null,
        },
        update: {
          isOccupied: !!input.isOccupied,
          assignedDoctor: input.assignedDoctor || null,
          patientId: input.patientId || null,
        },
      });
    } catch (error) {
      logPersistError('upsertTraumaBay', error);
    }
  }

  static async saveIncident(c: PersistCase): Promise<void> {
    try {
      await ihsDbClient.emergencyIncident.upsert({
        where: { id: c.case_id },
        create: {
          id: c.case_id,
          patientId: c.patient_id,
          status: c.current_status,
          latitude: c.live_lat,
          longitude: c.live_lng,
          driverId: c.assigned_fleet_id || null,
          fleetId: c.assigned_fleet_id || null,
          chiefComplaint: c.chief_complaint || null,
          driverStatus: c.driver_status || null,
          reservedBay: c.reserved_bay || null,
          assignedErDoctor: c.assigned_er_doctor || null,
          triagePriority: c.triage_priority || null,
          patientAge: c.patient_age || null,
          assignmentJson: c.assignment_snapshot
            ? JSON.stringify(c.assignment_snapshot)
            : null,
        },
        update: {
          status: c.current_status,
          latitude: c.live_lat,
          longitude: c.live_lng,
          driverId: c.assigned_fleet_id || null,
          fleetId: c.assigned_fleet_id || null,
          chiefComplaint: c.chief_complaint || null,
          driverStatus: c.driver_status || null,
          reservedBay: c.reserved_bay || null,
          assignedErDoctor: c.assigned_er_doctor || null,
          triagePriority: c.triage_priority || null,
          patientAge: c.patient_age || null,
          assignmentJson: c.assignment_snapshot
            ? JSON.stringify(c.assignment_snapshot)
            : null,
        },
      });

      // Legacy ClinicalCase shim for FSM/telemetry paths
      await ihsDbClient.clinicalCase.upsert({
        where: { case_id: c.case_id },
        create: {
          case_id: c.case_id,
          patient_id: c.patient_id,
          assigned_fleet_id: c.assigned_fleet_id,
          current_status: c.current_status,
          is_locked: c.is_locked,
          is_mlc: Boolean((c as { is_mlc?: boolean }).is_mlc),
          t_a: c.t_a ? new Date(c.t_a) : null,
        },
        update: {
          assigned_fleet_id: c.assigned_fleet_id,
          current_status: c.current_status,
          is_locked: c.is_locked,
          is_mlc: Boolean((c as { is_mlc?: boolean }).is_mlc),
          t_a: c.t_a ? new Date(c.t_a) : null,
        },
      });
    } catch (error) {
      logPersistError('saveIncident', error);
    }
  }

  static async saveAppointment(a: PersistAppointment, patientInternalId: string): Promise<void> {
    try {
      await ihsDbClient.appointment.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          patientId: patientInternalId,
          type: a.type,
          scheduledTime: new Date(a.when_iso),
          status: a.status,
          title: a.title,
          clinician: a.clinician,
          whenLabel: a.when_label,
          capitationStatus: a.capitation_status,
          notes: a.notes || null,
        },
        update: {
          type: a.type,
          scheduledTime: new Date(a.when_iso),
          status: a.status,
          title: a.title,
          clinician: a.clinician,
          whenLabel: a.when_label,
          capitationStatus: a.capitation_status,
          notes: a.notes || null,
        },
      });
    } catch (error) {
      logPersistError('saveAppointment', error);
    }
  }

  static async savePrescription(
    record: PersistVaultRecord,
    patientInternalId: string,
  ): Promise<void> {
    try {
      const primary = record.medicines?.[0];
      await ihsDbClient.ePrescription.upsert({
        where: { id: record.id },
        create: {
          id: record.id,
          patientId: patientInternalId,
          doctorName: record.prescribed_by || 'Dr. Ananya Rao',
          drugName: primary?.name || record.title,
          dosage: primary?.dose || '',
          instructions: record.summary,
          duration: primary?.duration || null,
          refills: primary?.refills ?? 0,
        },
        update: {
          doctorName: record.prescribed_by || 'Dr. Ananya Rao',
          drugName: primary?.name || record.title,
          dosage: primary?.dose || '',
          instructions: record.summary,
          duration: primary?.duration || null,
          refills: primary?.refills ?? 0,
        },
      });
    } catch (error) {
      logPersistError('savePrescription', error);
    }
  }

  static async upsertSubscription(patientId: string, remaining: number): Promise<void> {
    try {
      const existing = await ihsDbClient.subscription.findFirst({ where: { patientId } });
      if (existing) {
        await ihsDbClient.subscription.update({
          where: { id: existing.id },
          data: { doorstepVisitsRemaining: remaining, status: 'ACTIVE' },
        });
      } else {
        await ihsDbClient.subscription.create({
          data: {
            patientId,
            status: 'ACTIVE',
            doorstepVisitsRemaining: remaining,
          },
        });
      }
    } catch (error) {
      logPersistError('upsertSubscription', error);
    }
  }
}
