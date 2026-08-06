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
