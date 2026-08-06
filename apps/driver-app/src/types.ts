export type Gps = { lat: number; lng: number };

export type TripStep =
  | 'ACCEPT'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'HANDOFF'
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
  distance_km: number;
  eta_minutes: number;
  timestamp: string;
}

export const TRIP_PIPELINE: Array<{
  step: TripStep;
  label: string;
  statusEvent:
    | 'ACCEPTED'
    | 'EN_ROUTE_PATIENT'
    | 'ON_SCENE'
    | 'TRANSPORTING'
    | 'HANDOFF_COMPLETE';
}> = [
  { step: 'ACCEPT', label: 'ACCEPT DISPATCH', statusEvent: 'ACCEPTED' },
  { step: 'EN_ROUTE', label: 'EN ROUTE TO PATIENT', statusEvent: 'EN_ROUTE_PATIENT' },
  { step: 'ON_SCENE', label: 'ARRIVED ON SCENE', statusEvent: 'ON_SCENE' },
  { step: 'TRANSPORTING', label: 'TRANSPORTING TO HOSPITAL', statusEvent: 'TRANSPORTING' },
  { step: 'HANDOFF', label: 'PATIENT HANDOFF COMPLETE', statusEvent: 'HANDOFF_COMPLETE' },
];
