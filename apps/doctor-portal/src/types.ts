export type AppointmentType = 'teleconsult' | 'home_visit';
export type AppointmentStatus = 'queued' | 'in_consult' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  ihs_uid: string;
  patient_name: string;
  type: AppointmentType;
  title: string;
  clinician: string;
  when_label: string;
  when_iso: string;
  capitation_status: string;
  status: AppointmentStatus;
  notes?: string;
}

export interface VaultMedicine {
  name: string;
  dose: string;
  duration: string;
  quantity: number;
  refills?: number;
}

export interface VaultRecord {
  id: string;
  ihs_uid: string;
  title: string;
  category: string;
  date_label: string;
  worm_locked: boolean;
  summary: string;
  prescribed_by?: string;
  medicines?: VaultMedicine[];
}

export interface VitalReading {
  id: string;
  ihs_uid: string;
  metric: string;
  label: string;
  value: string;
  unit: string;
  recorded_at: string;
  source: string;
}

export interface PatientVault {
  patient: {
    ihs_uid: string;
    first_name: string;
    last_name: string;
  };
  vitals: VitalReading[];
  records: VaultRecord[];
  capitation: { status: string; visits_remaining: number };
}

export interface ClinicianSession {
  uid: string;
  name: string;
  role: string;
  token: string;
}

export type CallState = 'idle' | 'live' | 'muted' | 'ended';
