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
  age?: number;
  sector?: string;
  chief_complaint?: string;
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
  allergies?: string[];
}

export interface ClinicianSession {
  uid: string;
  name: string;
  role: string;
  token: string;
  credentials?: string;
}

export type CallState = 'idle' | 'live' | 'muted' | 'ended' | 'camera_off' | 'sharing';

export interface MedOption {
  id: string;
  name: string;
  stock: 'in_stock' | 'low' | 'out';
}

export const DOCTOR_PROFILE = {
  name: 'Dr. Ananya Rao',
  credentials: 'MBBS, MD',
  role: 'Ananthapur Grid Clinician',
  uid: 'DOC-101',
} as const;

export const MED_CATALOG: MedOption[] = [
  { id: 'para650', name: 'Paracetamol 650mg', stock: 'in_stock' },
  { id: 'amox500', name: 'Amoxicillin 500mg', stock: 'in_stock' },
  { id: 'azith500', name: 'Azithromycin 500mg', stock: 'low' },
  { id: 'ibu400', name: 'Ibuprofen 400mg', stock: 'in_stock' },
  { id: 'cet10', name: 'Cetirizine 10mg', stock: 'in_stock' },
  { id: 'omep20', name: 'Omeprazole 20mg', stock: 'in_stock' },
  { id: 'met500', name: 'Metformin 500mg', stock: 'in_stock' },
  { id: 'asp75', name: 'Aspirin 75mg', stock: 'low' },
];

export const DOSAGE_OPTIONS = [
  '1-0-1 (After Food)',
  '1-0-0 (Morning)',
  '0-0-1 (Night)',
  '1-1-1 (After Food)',
  'SOS (As needed)',
];

export const DURATION_OPTIONS = ['3 Days', '5 Days', '7 Days', '10 Days', '14 Days'];

export const DEMO_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-8802',
    ihs_uid: 'IHS-8802',
    patient_name: 'Lakshmi R.',
    type: 'teleconsult',
    title: 'Teleconsult',
    clinician: DOCTOR_PROFILE.name,
    when_label: 'Now · Live queue',
    when_iso: new Date().toISOString(),
    capitation_status: 'COVERED',
    status: 'queued',
    age: 58,
    sector: 'Ananthapur Urban',
    chief_complaint: 'Acute fever & follow-up review',
    notes: 'Acute fever & follow-up review',
  },
  {
    id: 'apt-8805',
    ihs_uid: 'IHS-8805',
    patient_name: 'Ramesh K.',
    type: 'teleconsult',
    title: 'Teleconsult',
    clinician: DOCTOR_PROFILE.name,
    when_label: 'Waiting · +6 min',
    when_iso: new Date(Date.now() + 360000).toISOString(),
    capitation_status: 'COVERED',
    status: 'queued',
    age: 44,
    sector: 'Dharmavaram',
    chief_complaint: 'Cough & mild dyspnea',
  },
  {
    id: 'apt-8811',
    ihs_uid: 'IHS-8811',
    patient_name: 'Fatima S.',
    type: 'teleconsult',
    title: 'Teleconsult',
    clinician: DOCTOR_PROFILE.name,
    when_label: 'Waiting · +12 min',
    when_iso: new Date(Date.now() + 720000).toISOString(),
    capitation_status: 'COPAY',
    status: 'queued',
    age: 31,
    sector: 'Gooty',
    chief_complaint: 'Postnatal wellness check',
  },
];

export const DEMO_VAULT: PatientVault = {
  patient: {
    ihs_uid: 'IHS-8802',
    first_name: 'Lakshmi',
    last_name: 'R.',
  },
  allergies: ['Penicillin'],
  vitals: [
    {
      id: 'v-hr',
      ihs_uid: 'IHS-8802',
      metric: 'hr',
      label: 'Heart Rate',
      value: '72',
      unit: 'bpm',
      recorded_at: new Date().toISOString(),
      source: 'Vault sync',
    },
    {
      id: 'v-spo2',
      ihs_uid: 'IHS-8802',
      metric: 'spo2',
      label: 'SpO₂',
      value: '98',
      unit: '%',
      recorded_at: new Date().toISOString(),
      source: 'Vault sync',
    },
    {
      id: 'v-bp',
      ihs_uid: 'IHS-8802',
      metric: 'bp',
      label: 'Blood Pressure',
      value: '120/80',
      unit: 'mmHg',
      recorded_at: new Date().toISOString(),
      source: 'Vault sync',
    },
  ],
  records: [
    {
      id: 'r1',
      ihs_uid: 'IHS-8802',
      title: 'E-Prescription — Paracetamol 650mg',
      category: 'Pharmacy',
      date_label: '28 Jul 2026',
      worm_locked: true,
      summary: '1-0-1 After Food · 5 Days · Fever',
      prescribed_by: 'Dr. Ananya Rao',
      medicines: [
        { name: 'Paracetamol 650mg', dose: '1-0-1 (After Food)', duration: '5 Days', quantity: 10 },
      ],
    },
    {
      id: 'r2',
      ihs_uid: 'IHS-8802',
      title: 'Lab Report — CBC & CRP',
      category: 'Labs',
      date_label: '22 Jul 2026',
      worm_locked: true,
      summary: 'Mild leukocytosis · CRP elevated · uploaded PDF',
      prescribed_by: 'GGH Pathology',
    },
    {
      id: 'r3',
      ihs_uid: 'IHS-8802',
      title: 'Teleconsult — Hypertension review',
      category: 'Consult',
      date_label: '10 Jul 2026',
      worm_locked: true,
      summary: 'BP stable · continue Amlodipine 5mg OD',
      prescribed_by: 'Dr. Meera A.',
    },
  ],
  capitation: { status: 'COVERED', visits_remaining: 4 },
};
