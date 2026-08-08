import type { CaseLifecycleState } from './clinical';

export type FleetUnitStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'OFFLINE' | 'MAINTENANCE';

export interface FleetUnit {
  fleet_id: string;
  callsign: string;
  status: FleetUnitStatus;
  als_capable: boolean;
  lat: number;
  lng: number;
  last_telemetry_at: string;
}

export interface DispatchCaseSummary {
  case_id: string;
  ihs_uid: string;
  state: CaseLifecycleState;
  priority: 'P1' | 'P2' | 'P3';
  sector: string;
  created_at: string;
  eta_mins: number | null;
  fleet_id: string | null;
}

export interface OpsKpiSnapshot {
  active_nodes: number;
  nodes_total: number;
  latency_ms: number;
  als_standby: number;
  avg_response_mins: number;
}
