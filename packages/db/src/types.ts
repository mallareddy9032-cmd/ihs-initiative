export type TriageServiceType = 'HOME_VISIT' | 'TELECONSULT' | 'EMERGENCY' | 'FOLLOW_UP';
export type TriageStatus = 'QUEUED' | 'DISPATCHED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
export type DispatchStatus =
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'COMPLETE'
  | 'CANCELLED';

export type Patient = {
  id: string;
  ihsUid: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  homeLat: number;
  homeLng: number;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultObject = {
  id: string;
  patientId: string;
  title: string;
  mimeType: string;
  ciphertext: string;
  iv: string;
  integrityHash: string;
  createdAt: Date;
};

export type TriageCase = {
  id: string;
  patientId: string;
  ihsUid: string;
  serviceType: TriageServiceType;
  status: TriageStatus;
  priority: string;
  sector: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DispatchRecord = {
  id: string;
  triageCaseId: string;
  fleetId: string | null;
  callsign: string | null;
  status: DispatchStatus;
  lat: number;
  lng: number;
  etaMins: number | null;
  lastTelemetryAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ClinicalChart = {
  id: string;
  patientId: string;
  triageCaseId: string | null;
  clinicianUid: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EPrescription = {
  id: string;
  chartId: string;
  drugName: string;
  dosage: string;
  duration: string;
  instructions: string | null;
  issuedAt: Date;
};

export type TriageCaseWithDispatch = TriageCase & {
  dispatch: DispatchRecord | null;
  patient?: Pick<Patient, 'id' | 'ihsUid' | 'firstName' | 'lastName'>;
};

export type ClinicalChartWithRx = ClinicalChart & {
  prescriptions: EPrescription[];
};
