export type Gps = { lat: number; lng: number };

export type TripStep =
  | 'ACKNOWLEDGE'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'PATIENT_LOADED'
  | 'TRANSPORTING'
  | 'COMPLETE';

export interface DispatchAssignment {
  case_id: string;
  fleet_id: string;
  driver_name?: string;
  patient_name: string;
  ihs_uid: string;
  patient_internal_id?: string;
  chief_complaint: string;
  live_gps: Gps;
  home_gps: Gps;
  driver_gps: Gps;
  hospital_name?: string;
  hospital_bay?: string;
  er_doctor?: string;
  sector?: string;
  distance_km: number;
  eta_minutes: number;
  timestamp: string;
}

export interface VitalsLog {
  hr: number;
  spo2: number;
  bpSys: number;
  bpDia: number;
  note: string;
  locked: boolean;
}

export const TRIP_PIPELINE: Array<{
  step: TripStep;
  label: string;
  statusEvent: string;
}> = [
  { step: 'ACKNOWLEDGE', label: '1. ACKNOWLEDGE DISPATCH', statusEvent: 'ACCEPTED' },
  { step: 'EN_ROUTE', label: '2. EN ROUTE TO PATIENT', statusEvent: 'EN_ROUTE_PATIENT' },
  { step: 'ON_SCENE', label: '3. ARRIVED ON SCENE', statusEvent: 'ON_SCENE' },
  { step: 'PATIENT_LOADED', label: '4. PATIENT LOADED', statusEvent: 'PATIENT_LOADED' },
  { step: 'TRANSPORTING', label: '5. TRANSPORTING TO ER', statusEvent: 'TRANSPORTING' },
  { step: 'COMPLETE', label: '6. TRIP COMPLETED', statusEvent: 'HANDOFF_COMPLETE' },
];

/** Ananthapuramu pilot defaults */
export const DRIVER_PROFILE = {
  name: 'Suresh Naidu',
  fleetId: 'ALS-02',
  vehicleReg: 'AP-02-EX-2214',
  vehicle: 'Force Traveller ALS',
  sector: 'Ananthapur Sector 01',
} as const;

export const GGH_ANANTHAPUR: Gps = { lat: 14.6785, lng: 77.5972 };

export const DEMO_ASSIGNMENT: DispatchAssignment = {
  case_id: 'case-ananthapur-8802',
  fleet_id: DRIVER_PROFILE.fleetId,
  driver_name: DRIVER_PROFILE.name,
  patient_name: 'Lakshmi R.',
  ihs_uid: 'IHS-8802',
  chief_complaint: 'Chest pain / Acute distress',
  live_gps: { lat: 14.6842, lng: 77.6051 },
  home_gps: { lat: 14.6819, lng: 77.6006 },
  driver_gps: { lat: 14.6819, lng: 77.6006 },
  hospital_name: 'GGH Ananthapuramu',
  hospital_bay: 'Trauma Bay T-03',
  er_doctor: 'Dr. Meera A.',
  sector: 'Ananthapur Urban · Sector 04',
  distance_km: 2.4,
  eta_minutes: 4,
  timestamp: new Date().toISOString(),
};
