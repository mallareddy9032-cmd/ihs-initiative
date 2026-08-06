import type { Appointment, ClinicianSession, PatientVault, VaultMedicine } from './types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
export const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8080';

export async function loginClinician(uid: string, pin: string): Promise<ClinicianSession> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ uid: uid.trim().toUpperCase(), pin }),
  });
  const body = (await res.json()) as {
    success?: boolean;
    token?: string;
    operator?: { uid: string; name: string; role: string };
    error?: string;
  };
  if (!res.ok || !body.operator || !body.token) {
    throw new Error(body.error || 'Login failed');
  }
  if (body.operator.role !== 'PHYSICIAN' && body.operator.role !== 'SYSTEM_ADMIN') {
    throw new Error('Clinician credentials required (PHYSICIAN role)');
  }
  return {
    uid: body.operator.uid,
    name: body.operator.name,
    role: body.operator.role,
    token: body.token,
  };
}

export async function fetchAppointments(): Promise<Appointment[]> {
  const res = await fetch(`${API_BASE}/v1/clinical/appointments`);
  const body = (await res.json()) as { appointments?: Appointment[]; error?: string };
  if (!res.ok) throw new Error(body.error || 'Failed to load appointments');
  return body.appointments || [];
}

export async function fetchPatientVault(ihsUid: string): Promise<PatientVault> {
  const res = await fetch(`${API_BASE}/v1/clinical/vault/${encodeURIComponent(ihsUid)}`);
  const body = (await res.json()) as PatientVault & { error?: string };
  if (!res.ok) throw new Error(body.error || 'Vault unavailable');
  return body;
}

export async function startConsult(appointmentId: string): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/v1/clinical/consult/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id: appointmentId }),
  });
  const body = (await res.json()) as { appointment?: Appointment; error?: string };
  if (!res.ok || !body.appointment) throw new Error(body.error || 'Could not start consult');
  return body.appointment;
}

export async function endConsult(appointmentId: string): Promise<Appointment> {
  const res = await fetch(`${API_BASE}/v1/clinical/consult/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appointment_id: appointmentId }),
  });
  const body = (await res.json()) as { appointment?: Appointment; error?: string };
  if (!res.ok || !body.appointment) throw new Error(body.error || 'Could not end consult');
  return body.appointment;
}

export async function issuePrescription(input: {
  patient_id: string;
  ihs_uid?: string;
  physician: string;
  prescribed_by?: string;
  appointment_id?: string;
  title?: string;
  drug_name: string;
  dosage_instructions: string;
  duration: string;
  refills: number;
  instructions?: string;
  medicines?: VaultMedicine[];
}): Promise<unknown> {
  const res = await fetch(`${API_BASE}/v1/prescriptions/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patient_id: input.patient_id,
      ihs_uid: input.ihs_uid || input.patient_id,
      physician: input.physician,
      prescribed_by: input.prescribed_by || input.physician,
      appointment_id: input.appointment_id,
      title: input.title,
      drug_name: input.drug_name,
      dosage: input.dosage_instructions,
      dosage_instructions: input.dosage_instructions,
      duration: input.duration,
      refills: input.refills,
      instructions: input.instructions,
      medicines: input.medicines,
    }),
  });
  const body = (await res.json()) as { success?: boolean; prescription?: unknown; error?: string };
  if (!res.ok) throw new Error(body.error || 'Failed to issue script');
  return body.prescription;
}
