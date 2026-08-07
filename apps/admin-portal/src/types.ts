export type DateRange = 'today' | '7d' | '30d';
export type NodeStatus = 'normal' | 'high' | 'surge';

export interface PilotNode {
  id: string;
  name: string;
  status: NodeStatus;
  dispatches: number;
  tatMin: number;
}

export interface MacroKpis {
  totalDispatches: number;
  dispatchDeltaPct: number;
  sub5TatSuccessPct: number;
  sub5TargetPct: number;
  avgResponseLabel: string;
  fleetMobilized: number;
  fleetTotal: number;
}

export interface TatBreakdown {
  id: string;
  label: string;
  actualLabel: string;
  actualSec: number;
  targetSec: number;
  targetLabel: string;
}

export interface AuditEntry {
  id: string;
  time: string;
  event: string;
  subject: string;
  hash: string;
}

export interface GovernanceToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const PILOT_NODES: PilotNode[] = [
  { id: 'n01', name: 'Ananthapur Urban', status: 'high', dispatches: 142, tatMin: 4.1 },
  { id: 'n02', name: 'Ananthapur Rural', status: 'normal', dispatches: 68, tatMin: 5.2 },
  { id: 'n03', name: 'Raptadu', status: 'normal', dispatches: 41, tatMin: 4.8 },
  { id: 'n04', name: 'B.K. Samudram', status: 'surge', dispatches: 55, tatMin: 3.9 },
  { id: 'n05', name: 'Garladinne', status: 'normal', dispatches: 33, tatMin: 5.0 },
  { id: 'n06', name: 'Kudair', status: 'normal', dispatches: 29, tatMin: 4.6 },
  { id: 'n07', name: 'Atmakur', status: 'high', dispatches: 47, tatMin: 4.3 },
  { id: 'n08', name: 'Singanamala', status: 'normal', dispatches: 36, tatMin: 4.9 },
  { id: 'n09', name: 'Narpala', status: 'normal', dispatches: 31, tatMin: 5.1 },
  { id: 'n10', name: 'Bathalapalle', status: 'high', dispatches: 52, tatMin: 4.2 },
  { id: 'n11', name: 'Dharmavaram', status: 'surge', dispatches: 88, tatMin: 3.7 },
  { id: 'n12', name: 'Chennekothapalle', status: 'normal', dispatches: 24, tatMin: 5.4 },
  { id: 'n13', name: 'Kanakal', status: 'normal', dispatches: 22, tatMin: 5.6 },
  { id: 'n14', name: 'Uravakonda', status: 'high', dispatches: 61, tatMin: 4.0 },
  { id: 'n15', name: 'Pamidi', status: 'normal', dispatches: 38, tatMin: 4.7 },
  { id: 'n16', name: 'Gooty', status: 'normal', dispatches: 44, tatMin: 4.5 },
  { id: 'n17', name: 'Peddavadugur', status: 'normal', dispatches: 27, tatMin: 5.3 },
  { id: 'n18', name: 'Putluru', status: 'normal', dispatches: 19, tatMin: 5.8 },
  { id: 'n19', name: 'Beluguppa', status: 'normal', dispatches: 21, tatMin: 5.5 },
  { id: 'n20', name: 'Bukkarayasamudram', status: 'high', dispatches: 58, tatMin: 4.4 },
];

export const DEMO_KPIS: MacroKpis = {
  totalDispatches: 1248,
  dispatchDeltaPct: 12,
  sub5TatSuccessPct: 94.2,
  sub5TargetPct: 90,
  avgResponseLabel: '04:18',
  fleetMobilized: 8,
  fleetTotal: 10,
};

export const TAT_BREAKDOWN: TatBreakdown[] = [
  {
    id: 'lag',
    label: 'Dispatch Lag',
    actualLabel: '00:42s',
    actualSec: 42,
    targetSec: 60,
    targetLabel: 'Target < 01:00m',
  },
  {
    id: 'transit',
    label: 'En-Route Transit',
    actualLabel: '03:12m',
    actualSec: 192,
    targetSec: 240,
    targetLabel: 'Target < 04:00m',
  },
  {
    id: 'handoff',
    label: 'ER Hand-off',
    actualLabel: '01:15m',
    actualSec: 75,
    targetSec: 120,
    targetLabel: 'Target < 02:00m',
  },
];

export const DEMO_AUDIT: AuditEntry[] = [
  {
    id: 'a1',
    time: '12:55:02',
    event: 'SOS_TRIGGERED',
    subject: 'Patient #IHS-8802',
    hash: '8f9a2c11d4e07b3a…3c12',
  },
  {
    id: 'a2',
    time: '12:55:05',
    event: 'DISPATCH_ACK',
    subject: 'Unit #ALS-01',
    hash: '4e21f8a09c6d1b72…9b04',
  },
  {
    id: 'a3',
    time: '12:56:18',
    event: 'EN_ROUTE_PATIENT',
    subject: 'Unit #ALS-02 · AP-02-EX-2214',
    hash: 'b3c8e1a4f9027d55…6a18',
  },
  {
    id: 'a4',
    time: '12:58:10',
    event: 'ER_BED_RESERVED',
    subject: 'Bay T-03 GGH Ananthapuramu',
    hash: '1a77c4e29f0b8d31…5e09',
  },
  {
    id: 'a5',
    time: '12:59:44',
    event: 'PRE_ARRIVAL_VITALS',
    subject: 'Lakshmi R. · HR 118 / SpO₂ 94%',
    hash: '9d02a7e5c1834f66…2b71',
  },
  {
    id: 'a6',
    time: '13:01:02',
    event: 'CLINICAL_DIRECTIVE',
    subject: 'Aspirin 300mg → ALS crew',
    hash: '7c14b9e0a2d65f88…4d03',
  },
];

export const DEMO_GOVERNANCE: GovernanceToggle[] = [
  {
    id: 'auto-dispatch',
    label: 'Emergency Auto-Dispatch Thresholds',
    description: 'Auto-mobilize nearest ALS when RED triage score ≥ 8 within the 50km grid.',
    enabled: true,
  },
  {
    id: 'er-prenotify',
    label: 'Mandatory ER Pre-Notification Rules',
    description: 'Require GGH Trauma Bay pre-alert before TRANSPORTING status is locked.',
    enabled: true,
  },
  {
    id: 'volunteer',
    label: 'Volunteer Network Dispatch Triggers',
    description: 'Ping certified first-responders when fleet saturation exceeds 80%.',
    enabled: false,
  },
];

/** Legacy snapshot shape kept for WS compatibility */
export interface RegionRow {
  id: string;
  name: string;
  zone: string;
  activeAmbulances: number;
  dispatchedIncidents: number;
  avgResponseMin: number;
  bedSaturationPct: number;
  nodeStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  wsNode: string;
}

export interface FleetUnitHealth {
  fleetId: string;
  region: string;
  fuelPct: number;
  shiftHours: number;
  status: 'ACTIVE' | 'STANDBY' | 'MAINTENANCE';
  alert?: string;
}

export interface ExecutiveSnapshot {
  generated_at: string;
  kpis: {
    avgTatMin: number;
    tatTargetMin: number;
    activeIncidents: number;
    fleetUtilization: { activePct: number; standbyPct: number; maintenancePct: number };
    bedSaturationPct: number;
    erHandoffAvgMin: number;
  };
  regions: RegionRow[];
  fleetHealth: FleetUnitHealth[];
  bottlenecks: Array<{
    region: string;
    hospital: string;
    saturationPct: number;
    severity: 'WARN' | 'CRITICAL';
  }>;
  connectivity: {
    dispatchers: number;
    drivers: number;
    hospitals: number;
    admins: number;
  };
}

export type RegionFilter = 'ALL' | 'VIZAG' | 'HYD' | 'KHAMMAM';
