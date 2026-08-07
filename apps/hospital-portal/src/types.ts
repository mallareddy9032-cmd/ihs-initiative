export type TriagePriority = 'RED' | 'YELLOW' | 'GREEN';
export type BayState = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED';

export interface Vitals {
  hr: number;
  spo2: number;
  bp_sys: number;
  bp_dia: number;
  note?: string;
  on_room_air?: boolean;
}

export interface IncomingTransport {
  case_id: string;
  fleet_id?: string;
  vehicle_reg?: string;
  vehicle_type?: string;
  driver_name?: string;
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
  assigned_team?: string | null;
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
  team?: string;
}

export interface VaultHistory {
  allergies: string[];
  conditions: string[];
  prescriptions: string[];
}

export interface ClinicalOrder {
  id: string;
  label: string;
  sent: boolean;
}

export const FACILITY = {
  name: 'GGH Ananthapuramu',
  dept: 'Emergency Department',
  dutyOfficer: 'Dr. Meera A.',
  dutyRole: 'Chief Triage',
} as const;

export const ER_DOCTORS = [
  'Dr. Meera A.',
  'Dr. Arjun Patel',
  'Dr. Nisha Reddy',
  'Dr. Vikram Sethi',
];

export const INITIAL_BAYS: TraumaBay[] = [
  { id: 'T-01', label: 'Trauma Bay T-01', state: 'AVAILABLE' },
  {
    id: 'T-02',
    label: 'Trauma Bay T-02',
    state: 'OCCUPIED',
    patientName: 'Resuscitation in progress',
    doctor: 'Dr. On-Call A',
    team: 'Trauma Team Alpha',
  },
  {
    id: 'T-03',
    label: 'Trauma Bay T-03',
    state: 'RESERVED',
    caseId: 'case-ananthapur-8802',
    patientName: 'Lakshmi R.',
    doctor: 'Dr. Meera A.',
    team: 'Cardiac Care Unit',
  },
  { id: 'T-04', label: 'Trauma Bay T-04', state: 'AVAILABLE' },
  { id: 'T-05', label: 'Trauma Bay T-05', state: 'AVAILABLE' },
  { id: 'T-06', label: 'Trauma Bay T-06', state: 'AVAILABLE' },
];

export const DEMO_INCOMING: IncomingTransport = {
  case_id: 'case-ananthapur-8802',
  fleet_id: 'ALS-02',
  vehicle_reg: 'AP-02-EX-2214',
  vehicle_type: 'Force Traveller ALS',
  driver_name: 'Suresh Naidu',
  patient_name: 'Lakshmi R.',
  ihs_uid: 'IHS-8802',
  patient_age: 58,
  chief_complaint: 'Acute Chest Pain / Suspected STEMI',
  triage_priority: 'RED',
  driver_status: 'TRANSPORTING',
  eta_minutes: 4,
  vitals: {
    hr: 118,
    spo2: 94,
    bp_sys: 140,
    bp_dia: 90,
    note: 'O2 initiated @ 4L/min, IV access secured',
    on_room_air: true,
  },
  hospital_name: FACILITY.name,
  reserved_bay: 'T-03',
  assigned_er_doctor: 'Dr. Meera A.',
  assigned_team: 'Cardiac Care Unit',
  timestamp: new Date().toISOString(),
  eta_deadline_ms: Date.now() + 3 * 60_000 + 40_000,
};

export const DEMO_VAULT: VaultHistory = {
  allergies: ['Penicillin'],
  conditions: ['Hypertension', 'Type 2 Diabetes'],
  prescriptions: ['Metformin 500mg BID', 'Amlodipine 5mg OD', 'Aspirin 75mg OD'],
};

export const CLINICAL_ORDERS: ClinicalOrder[] = [
  { id: 'o2', label: 'Prepare 100% O2', sent: false },
  { id: 'asa', label: 'Administer Aspirin 300mg', sent: false },
  { id: 'cath', label: 'Prepare Cath Lab Entry', sent: false },
  { id: 'ecg', label: 'Request STAT 12-Lead ECG', sent: false },
];
