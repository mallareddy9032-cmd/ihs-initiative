// ============================================================================
// FILE: src/data/fleetRoster.ts
// CONTEXT: Demo fleet roster for Command Center sidebar
// ============================================================================

export type FleetDriverStatus =
  | 'AVAILABLE'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'RETURNING'
  | 'OFFLINE';

export interface FleetUnit {
  fleetId: string;
  callSign: string;
  vehicle: string;
  driver: string;
  driverPhone: string;
  status: FleetDriverStatus;
  hospitalName: string;
  hospitalDistanceKm: number;
  etaToHospitalMin: number;
  lat: number;
  lng: number;
  alsCapable: boolean;
}

/** Visakhapatnam-area demo units for dispatcher sidebar */
export const FLEET_ROSTER: FleetUnit[] = [
  {
    fleetId: 'AMB-VSKP-07',
    callSign: 'Alpha-7',
    vehicle: 'Toyota HiAce ALS',
    driver: 'Ravi Kumar',
    driverPhone: '+91 98765 01122',
    status: 'AVAILABLE',
    hospitalName: 'KGH Visakhapatnam',
    hospitalDistanceKm: 4.2,
    etaToHospitalMin: 11,
    lat: 17.734,
    lng: 83.306,
    alsCapable: true,
  },
  {
    fleetId: 'AMB-VSKP-12',
    callSign: 'Bravo-12',
    vehicle: 'Force Traveller BLS',
    driver: 'Suresh Naidu',
    driverPhone: '+91 98765 04488',
    status: 'AVAILABLE',
    hospitalName: 'Care Hospital Ramnagar',
    hospitalDistanceKm: 2.8,
    etaToHospitalMin: 8,
    lat: 17.728,
    lng: 83.314,
    alsCapable: false,
  },
  {
    fleetId: 'AMB-VSKP-03',
    callSign: 'Charlie-3',
    vehicle: 'Mercedes Sprinter ALS',
    driver: 'Priya Devi',
    driverPhone: '+91 98765 07701',
    status: 'EN_ROUTE',
    hospitalName: 'Apollo Health City',
    hospitalDistanceKm: 6.1,
    etaToHospitalMin: 16,
    lat: 17.741,
    lng: 83.298,
    alsCapable: true,
  },
  {
    fleetId: 'AMB-VSKP-19',
    callSign: 'Delta-19',
    vehicle: 'Tata Winger ICU',
    driver: 'Mohammed Irfan',
    driverPhone: '+91 98765 09110',
    status: 'ON_SCENE',
    hospitalName: 'King George Hospital',
    hospitalDistanceKm: 3.4,
    etaToHospitalMin: 9,
    lat: 17.719,
    lng: 83.321,
    alsCapable: true,
  },
  {
    fleetId: 'AMB-VSKP-21',
    callSign: 'Echo-21',
    vehicle: 'Force Traveller BLS',
    driver: 'Lakshmi Prasad',
    driverPhone: '+91 98765 03340',
    status: 'RETURNING',
    hospitalName: 'Queens NRI Hospital',
    hospitalDistanceKm: 5.5,
    etaToHospitalMin: 14,
    lat: 17.712,
    lng: 83.289,
    alsCapable: false,
  },
  {
    fleetId: 'AMB-VSKP-05',
    callSign: 'Foxtrot-5',
    vehicle: 'Toyota HiAce ALS',
    driver: 'Anil Reddi',
    driverPhone: '+91 98765 05560',
    status: 'OFFLINE',
    hospitalName: 'KGH Visakhapatnam',
    hospitalDistanceKm: 7.9,
    etaToHospitalMin: 22,
    lat: 17.752,
    lng: 83.275,
    alsCapable: true,
  },
];

export function statusTone(status: FleetDriverStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-[#34C759]/12 text-[#34C759]';
    case 'EN_ROUTE':
      return 'bg-[#FF9500]/12 text-[#FF9500]';
    case 'ON_SCENE':
      return 'bg-[#007AFF]/12 text-[#007AFF]';
    case 'RETURNING':
      return 'bg-[#5856D6]/12 text-[#5856D6]';
    case 'OFFLINE':
    default:
      return 'bg-[#F2F2F7] text-[#8E8E93]';
  }
}
