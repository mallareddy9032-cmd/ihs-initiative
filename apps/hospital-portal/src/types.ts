export type TriagePriority = 'RED' | 'YELLOW' | 'GREEN';
export type BayState = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED';

export interface Vitals {
  hr: number;
  spo2: number;
  bp_sys: number;
  bp_dia: number;
}

export interface IncomingTransport {
  case_id: string;
  fleet_id?: string;
  patient_name: string;
  ihs_uid: string;
  patient_age: number;
  chief_complaint: string;
  triage_priority: TriagePriority;
  driver_status: string;
  eta_minutes: number;
  vitals: Vitals;
  hospital_name?: string;
  reserved_bay?: string | null;
  assigned_er_doctor?: string | null;
  timestamp: string;
  /** Local countdown anchor */
  eta_deadline_ms?: number;
}

export interface TraumaBay {
  id: string;
  label: string;
  state: BayState;
  caseId?: string;
  patientName?: string;
  doctor?: string;
}

export const ER_DOCTORS = [
  'Dr. Meera Krishnan',
  'Dr. Arjun Patel',
  'Dr. Nisha Reddy',
  'Dr. Vikram Sethi',
];

export const INITIAL_BAYS: TraumaBay[] = [
  {
    id: 'BAY-1',
    label: 'Trauma Bay 1',
    state: 'OCCUPIED',
    patientName: 'In-house trauma · bed locked',
    doctor: 'Dr. On-Call A',
  },
  { id: 'BAY-2', label: 'Trauma Bay 2', state: 'AVAILABLE' },
  { id: 'BAY-3', label: 'Trauma Bay 3', state: 'AVAILABLE' },
  { id: 'BAY-4', label: 'ER Bay 4', state: 'AVAILABLE' },
];
