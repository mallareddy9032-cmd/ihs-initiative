// ============================================================================
// FILE: src/infrastructure/demo/DemoStore.ts
// CONTEXT: In-memory hot store for local dispatcher demos (no Postgres required)
// ============================================================================

import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaPersist } from '../persistence/PrismaPersist';

export interface DemoPatient {
  internal_id: string;
  ihs_uid: string;
  first_name: string;
  last_name: string;
  home_lat: number;
  home_lng: number;
  is_proxy?: boolean;
}

export interface DemoOperator {
  operator_id: string;
  ihs_uid: string;
  full_name: string;
  hashed_pin: string;
  role: 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM_ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface DemoSubscription {
  subscription_id: string;
  patient_id: string;
  status: string;
  doorstep_visits_remaining: number;
}

export interface DemoCase {
  case_id: string;
  patient_id: string;
  current_status: 'INITIATED' | 'DISPATCHED' | 'CLOSED_RESOLVED' | 'ER_ADMITTED';
  is_locked: boolean;
  assigned_fleet_id?: string;
  t_a?: string;
  override_reason?: string;
  live_lat?: number;
  live_lng?: number;
  chief_complaint?: string;
  driver_status?: string;
  /** Cached assignment snapshot for ER receiving portal */
  assignment_snapshot?: Record<string, unknown>;
  reserved_bay?: string;
  assigned_er_doctor?: string;
  triage_priority?: 'RED' | 'YELLOW' | 'GREEN';
  patient_age?: number;
}

export interface DemoAppointment {
  id: string;
  ihs_uid: string;
  patient_name: string;
  type: 'teleconsult' | 'home_visit';
  title: string;
  clinician: string;
  when_label: string;
  when_iso: string;
  capitation_status: 'COVERED' | 'COPAY' | 'EXHAUSTED';
  status: 'queued' | 'in_consult' | 'completed' | 'cancelled';
  notes?: string;
}

export interface DemoVaultMedicine {
  name: string;
  dose: string;
  duration: string;
  quantity: number;
  refills?: number;
}

export interface DemoVaultRecord {
  id: string;
  ihs_uid: string;
  title: string;
  category: string;
  date_label: string;
  worm_locked: boolean;
  summary: string;
  medicines?: DemoVaultMedicine[];
  prescribed_by?: string;
}

export interface DemoVital {
  id: string;
  ihs_uid: string;
  metric: 'hr' | 'spo2' | 'bp' | 'temp' | 'glucose';
  label: string;
  value: string;
  unit: string;
  recorded_at: string;
  source: string;
}

class DemoStoreImpl {
  patients = new Map<string, DemoPatient>();
  operators = new Map<string, DemoOperator>();
  subscriptions = new Map<string, DemoSubscription>();
  cases = new Map<string, DemoCase>();
  appointments: DemoAppointment[] = [];
  vaultRecords: DemoVaultRecord[] = [];
  vitals: DemoVital[] = [];
  ready = false;

  async initialize(): Promise<void> {
    if (this.ready) return;

    // Visakhapatnam / Prakasam Nagar approximate home base
    const home = { lat: 17.7231, lng: 83.3012 };

    const patients: DemoPatient[] = [
      {
        internal_id: '11111111-1111-4111-8111-111111111001',
        ihs_uid: 'IHS-ADMIN-00001',
        first_name: 'Ramu',
        last_name: 'SuperAdmin',
        home_lat: home.lat,
        home_lng: home.lng,
      },
      {
        internal_id: '11111111-1111-4111-8111-111111111002',
        ihs_uid: 'IHS-ANTP-00001',
        first_name: 'Lakshmi',
        last_name: 'Devi',
        home_lat: home.lat,
        home_lng: home.lng,
      },
    ];

    for (const p of patients) {
      this.patients.set(p.ihs_uid, p);
      this.subscriptions.set(p.internal_id, {
        subscription_id: randomUUID(),
        patient_id: p.internal_id,
        status: 'ACTIVE',
        doorstep_visits_remaining: 3,
      });
    }

    const pin123456 = await bcrypt.hash('123456', 10);
    const physicianPin = await bcrypt.hash('654321', 10);

    const operators: DemoOperator[] = [
      {
        operator_id: '22222222-2222-4222-8222-222222222001',
        ihs_uid: 'DSP-0442',
        full_name: 'Ramu Dispatcher',
        hashed_pin: pin123456,
        role: 'DISPATCHER',
        status: 'ACTIVE',
      },
      {
        operator_id: '22222222-2222-4222-8222-222222222101',
        ihs_uid: 'DOC-101',
        full_name: 'Dr. Ananya Rao',
        hashed_pin: pin123456,
        role: 'PHYSICIAN',
        status: 'ACTIVE',
      },
      {
        operator_id: '22222222-2222-4222-8222-222222222102',
        ihs_uid: 'PHY-1001',
        full_name: 'Dr. Ananya Rao',
        hashed_pin: physicianPin,
        role: 'PHYSICIAN',
        status: 'ACTIVE',
      },
    ];

    for (const op of operators) {
      this.operators.set(op.ihs_uid, op);
    }

    this.appointments = [
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        patient_name: 'Ramu SuperAdmin',
        type: 'teleconsult',
        title: 'Teleconsult',
        clinician: 'Dr. Ananya Rao',
        when_label: 'Today · 5:30 PM',
        when_iso: new Date().toISOString(),
        capitation_status: 'COVERED',
        status: 'queued',
        notes: 'Fever follow-up · patient requests video consult',
      },
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        patient_name: 'Ramu SuperAdmin',
        type: 'home_visit',
        title: 'GP Home Visit',
        clinician: 'Dr. Ananya Rao',
        when_label: 'Tomorrow · 10:30 AM',
        when_iso: new Date(Date.now() + 86400000).toISOString(),
        capitation_status: 'COVERED',
        status: 'queued',
        notes: 'Doorstep GP · capitation visit remaining',
      },
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ANTP-00001',
        patient_name: 'Lakshmi Devi',
        type: 'teleconsult',
        title: 'Teleconsult',
        clinician: 'Dr. Ananya Rao',
        when_label: 'Tomorrow · 4:00 PM',
        when_iso: new Date(Date.now() + 90000000).toISOString(),
        capitation_status: 'COPAY',
        status: 'queued',
        notes: 'Quota low · ₹199 tele co-pay may apply',
      },
    ];

    this.vaultRecords = [
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        title: 'CBC · WORM Lab Result',
        category: 'Labs',
        date_label: '2 days ago',
        worm_locked: true,
        summary: 'Hb 13.2 · WBC 7.1 · Platelets normal. Day-31 cold vault queued.',
      },
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        title: 'Pharmacy e-Rx · Amoxicillin course',
        category: 'Pharmacy',
        date_label: '5 days ago',
        worm_locked: true,
        summary: 'Active medications from prior teleconsult.',
        prescribed_by: 'Dr. Ananya Rao',
        medicines: [
          {
            name: 'Amoxicillin',
            dose: '500mg · 1 tab 3x daily',
            duration: '5 days',
            quantity: 15,
          },
          {
            name: 'Paracetamol',
            dose: '650mg · SOS fever',
            duration: '3 days',
            quantity: 6,
          },
        ],
      },
    ];

    this.vitals = [
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        metric: 'hr',
        label: 'Heart Rate',
        value: '86',
        unit: 'bpm',
        recorded_at: 'Today · 09:12',
        source: 'BLE watch sync',
      },
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        metric: 'spo2',
        label: 'SpO₂',
        value: '97',
        unit: '%',
        recorded_at: 'Today · 09:12',
        source: 'BLE watch sync',
      },
      {
        id: randomUUID(),
        ihs_uid: 'IHS-ADMIN-00001',
        metric: 'bp',
        label: 'Blood Pressure',
        value: '122/78',
        unit: 'mmHg',
        recorded_at: 'Yesterday · 20:40',
        source: 'Manual entry',
      },
    ];

    // Persist seed into SQLite (Prisma) so restarts retain clinical data plane
    for (const p of patients) {
      await PrismaPersist.upsertPatient({
        ...p,
        phone: p.ihs_uid === 'IHS-ADMIN-00001' ? '+919876543210' : '+919888877766',
        emergencyContact: '+919000000001',
        capitationStatus: 'ACTIVE',
      });
      const sub = this.subscriptions.get(p.internal_id);
      if (sub) await PrismaPersist.upsertSubscription(p.internal_id, sub.doorstep_visits_remaining);
    }
    for (const op of operators) {
      await PrismaPersist.upsertOperator(op);
    }
    await PrismaPersist.upsertFleet({
      vehicleNumber: 'AMB-VSKP-07',
      driverName: 'Ravi Kumar',
      status: 'AVAILABLE',
      fuelLevel: 82,
      standbyPhone: process.env.TWILIO_STANDBY_DRIVER_PHONE || '+919876500007',
    });
    for (const bay of ['BAY-1', 'BAY-2', 'BAY-3', 'BAY-4']) {
      await PrismaPersist.upsertTraumaBay({ bayName: bay, isOccupied: false });
    }
    for (const apt of this.appointments) {
      const patient = this.findPatientByUid(apt.ihs_uid);
      if (patient) await PrismaPersist.saveAppointment(apt, patient.internal_id);
    }
    for (const rec of this.vaultRecords) {
      const patient = this.findPatientByUid(rec.ihs_uid);
      if (patient) await PrismaPersist.savePrescription(rec, patient.internal_id);
    }

    this.ready = true;
    console.log(
      '[DemoStore] Seeded + Prisma-persisted DOC-101 / DSP-0442 / IHS-ADMIN-00001 / AMB-VSKP-07',
    );
  }

  findPatientByUid(ihsUid: string): DemoPatient | undefined {
    return this.patients.get(ihsUid.toUpperCase());
  }

  findOperatorByUid(ihsUid: string): DemoOperator | undefined {
    return this.operators.get(ihsUid.toUpperCase());
  }

  findSubscription(patientId: string): DemoSubscription | undefined {
    return this.subscriptions.get(patientId);
  }

  createPanicCase(
    patientId: string,
    opts?: {
      live_lat?: number;
      live_lng?: number;
      chief_complaint?: string;
    },
  ): DemoCase {
    const clinicalCase: DemoCase = {
      case_id: randomUUID(),
      patient_id: patientId,
      current_status: 'INITIATED',
      is_locked: false,
      live_lat: opts?.live_lat,
      live_lng: opts?.live_lng,
      chief_complaint: opts?.chief_complaint ?? 'SOS Panic Trigger',
    };
    this.cases.set(clinicalCase.case_id, clinicalCase);
    void PrismaPersist.saveIncident(clinicalCase);
    return clinicalCase;
  }

  updateCaseDriverStatus(caseId: string, status: string, fleetId?: string): void {
    const clinicalCase = this.cases.get(caseId);
    if (!clinicalCase) return;
    clinicalCase.driver_status = status;
    if (fleetId) clinicalCase.assigned_fleet_id = fleetId;
    if (status === 'HANDOFF_COMPLETE' && clinicalCase.current_status !== 'ER_ADMITTED') {
      clinicalCase.current_status = 'CLOSED_RESOLVED';
    }
    void PrismaPersist.saveIncident(clinicalCase);
  }

  saveAssignmentSnapshot(caseId: string, snapshot: Record<string, unknown>): void {
    const clinicalCase = this.cases.get(caseId);
    if (!clinicalCase) return;
    clinicalCase.assignment_snapshot = snapshot;
    clinicalCase.triage_priority =
      (snapshot.triage_priority as DemoCase['triage_priority']) || 'RED';
    clinicalCase.patient_age =
      typeof snapshot.patient_age === 'number' ? snapshot.patient_age : 54;
    void PrismaPersist.saveIncident(clinicalCase);
  }

  reserveBay(caseId: string, bayId: string, doctor: string): DemoCase | undefined {
    const clinicalCase = this.cases.get(caseId);
    if (!clinicalCase) return undefined;
    clinicalCase.reserved_bay = bayId;
    clinicalCase.assigned_er_doctor = doctor;
    void PrismaPersist.saveIncident(clinicalCase);
    void PrismaPersist.upsertTraumaBay({
      bayName: bayId,
      isOccupied: true,
      assignedDoctor: doctor,
      patientId: clinicalCase.patient_id,
    });
    return clinicalCase;
  }

  confirmErIntake(caseId: string): DemoCase | undefined {
    const clinicalCase = this.cases.get(caseId);
    if (!clinicalCase) return undefined;
    clinicalCase.current_status = 'ER_ADMITTED';
    clinicalCase.driver_status = 'ER_INTAKE_CONFIRMED';
    void PrismaPersist.saveIncident(clinicalCase);
    if (clinicalCase.reserved_bay) {
      void PrismaPersist.upsertTraumaBay({
        bayName: clinicalCase.reserved_bay,
        isOccupied: true,
        assignedDoctor: clinicalCase.assigned_er_doctor,
        patientId: clinicalCase.patient_id,
      });
    }
    return clinicalCase;
  }

  findPatientByInternalId(internalId: string): DemoPatient | undefined {
    for (const p of this.patients.values()) {
      if (p.internal_id === internalId) return p;
    }
    return undefined;
  }

  getCaseWithPatient(caseId: string): {
    clinicalCase: DemoCase;
    patient: DemoPatient;
  } | null {
    const clinicalCase = this.cases.get(caseId);
    if (!clinicalCase) return null;
    const patient = this.findPatientByInternalId(clinicalCase.patient_id);
    if (!patient) return null;
    return { clinicalCase, patient };
  }

  findCase(caseId: string): DemoCase | undefined {
    return this.cases.get(caseId);
  }

  findLatestInitiatedCase(patientId: string): DemoCase | undefined {
    let latest: DemoCase | undefined;
    for (const c of this.cases.values()) {
      if (c.patient_id === patientId && c.current_status === 'INITIATED') {
        latest = c;
      }
    }
    return latest;
  }

  mobilizeCheck(patientId: string): { ok: true; fee: 0; remaining: number } | { ok: false; fee: 499 } {
    const sub = this.findSubscription(patientId);
    if (!sub || sub.status !== 'ACTIVE' || sub.doorstep_visits_remaining <= 0) {
      return { ok: false, fee: 499 };
    }
    return { ok: true, fee: 0, remaining: sub.doorstep_visits_remaining };
  }

  attemptDispatch(caseId: string, patientId: string, overrideReason?: string) {
    const check = this.mobilizeCheck(patientId);
    if (!check.ok) {
      return { success: false as const, requiresCoPay: true as const, fee: 499 };
    }

    const clinicalCase = this.findCase(caseId);
    if (!clinicalCase || clinicalCase.patient_id !== patientId) {
      throw new Error('CASE_NOT_FOUND');
    }
    if (clinicalCase.current_status !== 'INITIATED') {
      throw new Error('INVALID_STATE_TRANSITION');
    }

    const sub = this.findSubscription(patientId)!;
    sub.doorstep_visits_remaining -= 1;
    clinicalCase.current_status = 'DISPATCHED';
    clinicalCase.t_a = new Date().toISOString();
    clinicalCase.assigned_fleet_id = 'AMB-VSKP-07';
    clinicalCase.override_reason = overrideReason;
    void PrismaPersist.saveIncident(clinicalCase);
    void PrismaPersist.upsertSubscription(patientId, sub.doorstep_visits_remaining);
    void PrismaPersist.upsertFleet({
      vehicleNumber: 'AMB-VSKP-07',
      driverName: 'Ravi Kumar',
      status: 'DISPATCHED',
      fuelLevel: 82,
    });

    return {
      success: true as const,
      requiresCoPay: false as const,
      fee: 0,
      case: clinicalCase,
      remaining: sub.doorstep_visits_remaining,
      fleet_id: clinicalCase.assigned_fleet_id,
    };
  }

  listAppointments(status?: DemoAppointment['status']): DemoAppointment[] {
    return this.appointments
      .filter((a) => (status ? a.status === status : true))
      .slice()
      .sort((a, b) => a.when_iso.localeCompare(b.when_iso));
  }

  getAppointment(id: string): DemoAppointment | undefined {
    return this.appointments.find((a) => a.id === id);
  }

  updateAppointmentStatus(
    id: string,
    status: DemoAppointment['status'],
  ): DemoAppointment | undefined {
    const apt = this.getAppointment(id);
    if (!apt) return undefined;
    apt.status = status;
    const patient = this.findPatientByUid(apt.ihs_uid);
    if (patient) void PrismaPersist.saveAppointment(apt, patient.internal_id);
    return apt;
  }

  queueAppointment(
    input: Omit<DemoAppointment, 'id' | 'status'> & { status?: DemoAppointment['status'] },
  ): DemoAppointment {
    const created: DemoAppointment = {
      ...input,
      id: randomUUID(),
      status: input.status ?? 'queued',
    };
    this.appointments.unshift(created);
    const patient = this.findPatientByUid(created.ihs_uid);
    if (patient) void PrismaPersist.saveAppointment(created, patient.internal_id);
    return created;
  }

  getPatientVault(ihsUid: string): {
    patient: DemoPatient;
    vitals: DemoVital[];
    records: DemoVaultRecord[];
    capitation: { status: string; visits_remaining: number };
  } | null {
    const patient = this.findPatientByUid(ihsUid);
    if (!patient) return null;
    const sub = this.findSubscription(patient.internal_id);
    return {
      patient,
      vitals: this.vitals.filter((v) => v.ihs_uid === patient.ihs_uid),
      records: this.vaultRecords.filter((r) => r.ihs_uid === patient.ihs_uid),
      capitation: {
        status: sub?.status ?? 'INACTIVE',
        visits_remaining: sub?.doorstep_visits_remaining ?? 0,
      },
    };
  }

  issuePrescription(input: {
    ihs_uid: string;
    prescribed_by: string;
    title?: string;
    medicines: DemoVaultMedicine[];
    instructions?: string;
  }): DemoVaultRecord | null {
    const patient = this.findPatientByUid(input.ihs_uid);
    if (!patient) return null;
    const names = input.medicines.map((m) => m.name).join(', ');
    const record: DemoVaultRecord = {
      id: randomUUID(),
      ihs_uid: patient.ihs_uid,
      title: input.title || `e-Rx · ${names}`,
      category: 'Pharmacy',
      date_label: 'Just now',
      worm_locked: true,
      summary: input.instructions || `Digital script issued by ${input.prescribed_by}.`,
      prescribed_by: input.prescribed_by,
      medicines: input.medicines,
    };
    this.vaultRecords.unshift(record);
    void PrismaPersist.savePrescription(record, patient.internal_id);
    return record;
  }
}

export const DemoStore = new DemoStoreImpl();

export function isDemoMode(): boolean {
  return process.env.IHS_DEMO_MODE === 'true' || process.env.IHS_DEMO_MODE === '1';
}

/** True when the active data plane (demo store or DB path) can serve traffic. */
export function isDataPlaneReady(): boolean {
  if (isDemoMode()) {
    return DemoStore.ready;
  }
  return Boolean(process.env.DATABASE_URL);
}
