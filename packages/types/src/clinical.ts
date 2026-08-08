export type CaseLifecycleState =
  | 'CREATED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'AT_FACILITY'
  | 'CLOSED'
  | 'CANCELLED';

export type CapitationStatus = 'COVERED' | 'EXHAUSTED' | 'PENDING' | 'EXCLUDED_MLC';

export interface PatientIdentity {
  ihs_uid: string;
  first_name: string;
  last_name: string;
}

export interface VitalSignReading {
  recorded_at: string;
  heart_rate_bpm: number | null;
  spo2_pct: number | null;
  systolic_mmhg: number | null;
  diastolic_mmhg: number | null;
  temp_c: number | null;
}

export interface VaultRecordMeta {
  id: string;
  title: string;
  recorded_at: string;
  mime_type: string;
}

export interface EncryptedVaultSnapshot {
  patient: PatientIdentity;
  vitals: VitalSignReading[];
  records: VaultRecordMeta[];
  allergies: string[];
  capitation: {
    status: CapitationStatus;
    visits_remaining: number;
  };
}

export interface TriageQueueItem {
  id: string;
  ihs_uid: string;
  patient_name: string;
  when_iso: string;
  status: 'queued' | 'in_consult' | 'completed' | 'cancelled';
  type: 'teleconsult' | 'home_visit' | 'follow_up';
  title: string;
  clinician: string;
  capitation_status: CapitationStatus;
}
