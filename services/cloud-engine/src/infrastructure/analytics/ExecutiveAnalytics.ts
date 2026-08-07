// ============================================================================
// FILE: src/infrastructure/analytics/ExecutiveAnalytics.ts
// CONTEXT: Regional KPI seed + live counters for SuperAdmin dashboard
// ============================================================================

import { DispatchSlaMetrics } from '../metrics/DispatchSlaMetrics';

export type RegionId = 'VIZAG' | 'HYD' | 'KHAMMAM' | 'ALL';

export interface RegionRow {
  id: Exclude<RegionId, 'ALL'>;
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
  bottlenecks: Array<{ region: string; hospital: string; saturationPct: number; severity: 'WARN' | 'CRITICAL' }>;
  connectivity: {
    dispatchers: number;
    drivers: number;
    hospitals: number;
    admins: number;
  };
}

const regions: RegionRow[] = [
  {
    id: 'VIZAG',
    name: 'Vizag Metro',
    zone: 'AP Coastal North',
    activeAmbulances: 14,
    dispatchedIncidents: 3,
    avgResponseMin: 4.1,
    bedSaturationPct: 72,
    nodeStatus: 'HEALTHY',
    wsNode: 'AP-SOUTH-2a',
  },
  {
    id: 'HYD',
    name: 'Hyderabad Central',
    zone: 'TG Metro Core',
    activeAmbulances: 22,
    dispatchedIncidents: 5,
    avgResponseMin: 4.6,
    bedSaturationPct: 91,
    nodeStatus: 'HEALTHY',
    wsNode: 'AP-SOUTH-2b',
  },
  {
    id: 'KHAMMAM',
    name: 'Khammam Range',
    zone: 'TG East Corridor',
    activeAmbulances: 9,
    dispatchedIncidents: 1,
    avgResponseMin: 5.4,
    bedSaturationPct: 61,
    nodeStatus: 'DEGRADED',
    wsNode: 'AP-SOUTH-2c',
  },
];

const fleetHealth: FleetUnitHealth[] = [
  { fleetId: 'AMB-VSKP-07', region: 'Vizag Metro', fuelPct: 68, shiftHours: 5.2, status: 'ACTIVE' },
  { fleetId: 'AMB-VSKP-12', region: 'Vizag Metro', fuelPct: 41, shiftHours: 3.1, status: 'STANDBY' },
  {
    fleetId: 'AMB-HYD-04',
    region: 'Hyderabad Central',
    fuelPct: 22,
    shiftHours: 8.4,
    status: 'ACTIVE',
    alert: 'Low fuel · schedule refill',
  },
  {
    fleetId: 'AMB-HYD-11',
    region: 'Hyderabad Central',
    fuelPct: 90,
    shiftHours: 1.5,
    status: 'MAINTENANCE',
    alert: 'ALS stretcher calibration due',
  },
  { fleetId: 'AMB-KMM-02', region: 'Khammam Range', fuelPct: 77, shiftHours: 4.0, status: 'STANDBY' },
  {
    fleetId: 'AMB-KMM-05',
    region: 'Khammam Range',
    fuelPct: 15,
    shiftHours: 9.1,
    status: 'MAINTENANCE',
    alert: 'Battery pack below threshold',
  },
];

let liveIncidentBoost = 0;
let tatSamples = [4.0, 4.3, 4.1, 4.5, 4.2];
let handoffSamples = [6.2, 5.8, 7.1, 6.5];
let slaMetricsSeeded = false;

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function ensureSlaMetricsSeeded(): void {
  if (slaMetricsSeeded) return;
  slaMetricsSeeded = true;
  DispatchSlaMetrics.seedFromMinuteSamples(tatSamples);
}

export class ExecutiveAnalytics {
  static noteIncidentEvent(regionHint?: string): void {
    ensureSlaMetricsSeeded();
    liveIncidentBoost += 1;
    const region =
      regions.find((r) => r.name.toLowerCase().includes((regionHint || 'vizag').toLowerCase())) ||
      regions[0];
    region.dispatchedIncidents += 1;
    const sampleMin = 3.8 + Math.random() * 1.4;
    tatSamples.push(sampleMin);
    if (tatSamples.length > 20) tatSamples.shift();
    DispatchSlaMetrics.observeTatSeconds(sampleMin * 60, 'analytics');
  }

  static noteErIntake(): void {
    handoffSamples.push(5.5 + Math.random() * 2.5);
    if (handoffSamples.length > 20) handoffSamples.shift();
    if (liveIncidentBoost > 0) liveIncidentBoost -= 1;
    const hyd = regions.find((r) => r.id === 'HYD');
    if (hyd) hyd.bedSaturationPct = Math.min(98, hyd.bedSaturationPct + 1);
  }

  static noteDriverStatus(status?: string): void {
    if (status === 'TRANSPORTING' || status === 'EN_ROUTE_PATIENT') {
      ExecutiveAnalytics.noteIncidentEvent('vizag');
    }
  }

  static snapshot(connectivity: ExecutiveSnapshot['connectivity']): ExecutiveSnapshot {
    ensureSlaMetricsSeeded();
    const active = fleetHealth.filter((f) => f.status === 'ACTIVE').length;
    const standby = fleetHealth.filter((f) => f.status === 'STANDBY').length;
    const maint = fleetHealth.filter((f) => f.status === 'MAINTENANCE').length;
    const total = fleetHealth.length || 1;

    const bedSaturationPct = Math.round(
      regions.reduce((s, r) => s + r.bedSaturationPct, 0) / regions.length,
    );

    const activeIncidents =
      regions.reduce((s, r) => s + r.dispatchedIncidents, 0) + Math.max(0, liveIncidentBoost);

    const bottlenecks = regions
      .filter((r) => r.bedSaturationPct >= 90)
      .map((r) => ({
        region: r.name,
        hospital: r.id === 'HYD' ? 'Apollo Health City' : r.id === 'VIZAG' ? 'KGH Visakhapatnam' : 'Khammam District Hospital',
        saturationPct: r.bedSaturationPct,
        severity: (r.bedSaturationPct >= 95 ? 'CRITICAL' : 'WARN') as 'WARN' | 'CRITICAL',
      }));

    const avgTatMin = avg(tatSamples);

    return {
      generated_at: new Date().toISOString(),
      kpis: {
        avgTatMin,
        tatTargetMin: 5.0,
        activeIncidents,
        fleetUtilization: {
          activePct: Math.round((active / total) * 100),
          standbyPct: Math.round((standby / total) * 100),
          maintenancePct: Math.round((maint / total) * 100),
        },
        bedSaturationPct,
        erHandoffAvgMin: avg(handoffSamples),
      },
      regions: regions.map((r) => ({ ...r })),
      fleetHealth: fleetHealth.map((f) => ({ ...f })),
      bottlenecks,
      connectivity,
    };
  }
}
