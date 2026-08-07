// ============================================================================
// FILE: src/data/fleetRoster.ts
// CONTEXT: Ananthapuramu pilot fleet roster for Command Center
// ============================================================================

export type FleetDriverStatus =
  | 'AVAILABLE'
  | 'EN_ROUTE'
  | 'ON_SCENE'
  | 'TRANSPORTING'
  | 'RETURNING'
  | 'OFFLINE';

export interface FleetUnit {
  fleetId: string;
  callSign: string;
  vehicle: string;
  vehicleReg: string;
  driver: string;
  driverPhone: string;
  status: FleetDriverStatus;
  station: string;
  hospitalName: string;
  hospitalDistanceKm: number;
  etaToHospitalMin: number;
  speedKmh: number;
  headingDeg: number;
  lat: number;
  lng: number;
  alsCapable: boolean;
}

/** Ananthapuramu / Sri Sathya Sai pilot-zone units */
export const FLEET_ROSTER: FleetUnit[] = [
  {
    fleetId: 'ALS-01',
    callSign: 'Alpha-1',
    vehicle: 'Toyota HiAce ALS',
    vehicleReg: 'AP-02-EX-1088',
    driver: 'Ramesh K.',
    driverPhone: '+91 98765 01122',
    status: 'EN_ROUTE',
    station: 'Ananthapur Urban',
    hospitalName: 'GGH Ananthapuramu',
    hospitalDistanceKm: 3.2,
    etaToHospitalMin: 9,
    speedKmh: 42,
    headingDeg: 118,
    lat: 14.689,
    lng: 77.608,
    alsCapable: true,
  },
  {
    fleetId: 'ALS-02',
    callSign: 'Bravo-2',
    vehicle: 'Force Traveller ALS',
    vehicleReg: 'AP-02-EX-2214',
    driver: 'Suresh Naidu',
    driverPhone: '+91 98765 04488',
    status: 'AVAILABLE',
    station: 'Ananthapur Urban',
    hospitalName: 'GGH Ananthapuramu',
    hospitalDistanceKm: 2.1,
    etaToHospitalMin: 6,
    speedKmh: 0,
    headingDeg: 0,
    lat: 14.6819,
    lng: 77.6006,
    alsCapable: true,
  },
  {
    fleetId: 'BLS-03',
    callSign: 'Charlie-3',
    vehicle: 'Tata Winger BLS',
    vehicleReg: 'AP-02-EX-3301',
    driver: 'Priya Devi',
    driverPhone: '+91 98765 07701',
    status: 'AVAILABLE',
    station: 'Raptadu',
    hospitalName: 'Rural Health Center Raptadu',
    hospitalDistanceKm: 4.8,
    etaToHospitalMin: 12,
    speedKmh: 0,
    headingDeg: 45,
    lat: 14.652,
    lng: 77.568,
    alsCapable: false,
  },
  {
    fleetId: 'ALS-04',
    callSign: 'Delta-4',
    vehicle: 'Mercedes Sprinter ALS',
    vehicleReg: 'AP-02-EX-4410',
    driver: 'Mohammed Irfan',
    driverPhone: '+91 98765 09110',
    status: 'AVAILABLE',
    station: 'Dharmavaram',
    hospitalName: 'Area Hospital Dharmavaram',
    hospitalDistanceKm: 5.4,
    etaToHospitalMin: 14,
    speedKmh: 0,
    headingDeg: 210,
    lat: 14.414,
    lng: 77.72,
    alsCapable: true,
  },
  {
    fleetId: 'ALS-05',
    callSign: 'Echo-5',
    vehicle: 'Toyota HiAce ALS',
    vehicleReg: 'AP-02-EX-5522',
    driver: 'Lakshmi Prasad',
    driverPhone: '+91 98765 03340',
    status: 'ON_SCENE',
    station: 'Gooty',
    hospitalName: 'Community Health Center Gooty',
    hospitalDistanceKm: 6.2,
    etaToHospitalMin: 16,
    speedKmh: 0,
    headingDeg: 90,
    lat: 15.121,
    lng: 77.634,
    alsCapable: true,
  },
  {
    fleetId: 'BLS-06',
    callSign: 'Foxtrot-6',
    vehicle: 'Force Traveller BLS',
    vehicleReg: 'AP-02-EX-6633',
    driver: 'Anil Reddi',
    driverPhone: '+91 98765 05560',
    status: 'TRANSPORTING',
    station: 'Pamidi',
    hospitalName: 'GGH Ananthapuramu',
    hospitalDistanceKm: 8.1,
    etaToHospitalMin: 18,
    speedKmh: 48,
    headingDeg: 165,
    lat: 14.92,
    lng: 77.58,
    alsCapable: false,
  },
  {
    fleetId: 'ALS-07',
    callSign: 'Golf-7',
    vehicle: 'Toyota HiAce ALS',
    vehicleReg: 'AP-02-EX-7744',
    driver: 'Venkatesh M.',
    driverPhone: '+91 98765 06670',
    status: 'AVAILABLE',
    station: 'Uravakonda',
    hospitalName: 'Area Hospital Uravakonda',
    hospitalDistanceKm: 7.3,
    etaToHospitalMin: 17,
    speedKmh: 0,
    headingDeg: 320,
    lat: 14.945,
    lng: 77.255,
    alsCapable: true,
  },
  {
    fleetId: 'ALS-08',
    callSign: 'Hotel-8',
    vehicle: 'Mercedes Sprinter ALS',
    vehicleReg: 'AP-02-EX-8855',
    driver: 'Kavitha S.',
    driverPhone: '+91 98765 08890',
    status: 'AVAILABLE',
    station: 'Singanamala',
    hospitalName: 'PHC Singanamala',
    hospitalDistanceKm: 5.9,
    etaToHospitalMin: 15,
    speedKmh: 0,
    headingDeg: 40,
    lat: 14.8,
    lng: 77.72,
    alsCapable: true,
  },
];

export const PILOT_NODES = [
  { name: 'Ananthapur Urban', lat: 14.6819, lng: 77.6006 },
  { name: 'Raptadu', lat: 14.652, lng: 77.568 },
  { name: 'Dharmavaram', lat: 14.414, lng: 77.72 },
  { name: 'Gooty', lat: 15.121, lng: 77.634 },
  { name: 'Pamidi', lat: 14.92, lng: 77.58 },
  { name: 'Uravakonda', lat: 14.945, lng: 77.255 },
  { name: 'Singanamala', lat: 14.8, lng: 77.72 },
  { name: 'Atmakur', lat: 14.64, lng: 77.36 },
] as const;

export function statusTone(status: FleetDriverStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-[#0D5C4D]/12 text-[#0D5C4D]';
    case 'EN_ROUTE':
      return 'bg-[#2563EB]/12 text-[#2563EB]';
    case 'ON_SCENE':
      return 'bg-[#D97706]/12 text-[#D97706]';
    case 'TRANSPORTING':
      return 'bg-[#DC2626]/12 text-[#DC2626]';
    case 'RETURNING':
      return 'bg-[#6B46C1]/12 text-[#6B46C1]';
    case 'OFFLINE':
    default:
      return 'bg-[#F7F5F0] text-[#6B6B70]';
  }
}

export function statusLabel(status: FleetDriverStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return 'Available';
    case 'EN_ROUTE':
      return 'En Route';
    case 'ON_SCENE':
      return 'On Scene';
    case 'TRANSPORTING':
      return '→ ER Trauma';
    case 'RETURNING':
      return 'Returning';
    case 'OFFLINE':
      return 'Offline';
  }
}
