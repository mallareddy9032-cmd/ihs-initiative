// ============================================================================
// FILE: src/data/dispatchAnalytics.ts
// CONTEXT: Demo analytics + audit ledger for Command Center
// ============================================================================

export type CaseResolution =
  | 'RESOLVED_HOME'
  | 'HOSPITAL_TRANSFER'
  | 'FALSE_ALARM'
  | 'QUOTA_COPAY'
  | 'CANCELLED';

export interface DispatchHistoryRow {
  caseId: string;
  ihsUid: string;
  patientName: string;
  fleetId: string;
  driver: string;
  triggeredAt: string;
  acceptedSec: number; // T_A - trigger
  mobilizedSec: number; // T_M - T_A
  onSceneSec: number; // arrival - T_M
  totalResponseSec: number;
  resolution: CaseResolution;
  hospitalKm: number | null;
  actor: string;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  event: string;
  actor: string;
  ihsUid: string;
  detail: string;
  hash: string;
}

export const DISPATCH_HISTORY: DispatchHistoryRow[] = [
  {
    caseId: 'CASE-8821',
    ihsUid: 'IHS-ANTP-00001',
    patientName: 'Lakshmi Devi',
    fleetId: 'AMB-VSKP-07',
    driver: 'Ravi Kumar',
    triggeredAt: '2026-08-06 14:12',
    acceptedSec: 42,
    mobilizedSec: 95,
    onSceneSec: 610,
    totalResponseSec: 747,
    resolution: 'RESOLVED_HOME',
    hospitalKm: null,
    actor: 'DSP-0442',
  },
  {
    caseId: 'CASE-8814',
    ihsUid: 'IHS-ADMIN-00001',
    patientName: 'Ramu SuperAdmin',
    fleetId: 'AMB-VSKP-12',
    driver: 'Suresh Naidu',
    triggeredAt: '2026-08-06 11:03',
    acceptedSec: 28,
    mobilizedSec: 110,
    onSceneSec: 540,
    totalResponseSec: 678,
    resolution: 'HOSPITAL_TRANSFER',
    hospitalKm: 4.2,
    actor: 'DSP-0442',
  },
  {
    caseId: 'CASE-8802',
    ihsUid: 'IHS-ANTP-00018',
    patientName: 'Venkatesh Rao',
    fleetId: 'AMB-VSKP-03',
    driver: 'Priya Devi',
    triggeredAt: '2026-08-05 19:44',
    acceptedSec: 67,
    mobilizedSec: 140,
    onSceneSec: 720,
    totalResponseSec: 927,
    resolution: 'RESOLVED_HOME',
    hospitalKm: null,
    actor: 'DSP-0442',
  },
  {
    caseId: 'CASE-8791',
    ihsUid: 'IHS-ANTP-00007',
    patientName: 'Fatima Begum',
    fleetId: 'AMB-VSKP-19',
    driver: 'Mohammed Irfan',
    triggeredAt: '2026-08-05 08:21',
    acceptedSec: 35,
    mobilizedSec: 88,
    onSceneSec: 480,
    totalResponseSec: 603,
    resolution: 'FALSE_ALARM',
    hospitalKm: null,
    actor: 'DSP-0310',
  },
  {
    caseId: 'CASE-8775',
    ihsUid: 'IHS-ANTP-00022',
    patientName: 'Karthik Reddy',
    fleetId: 'AMB-VSKP-07',
    driver: 'Ravi Kumar',
    triggeredAt: '2026-08-04 16:55',
    acceptedSec: 51,
    mobilizedSec: 102,
    onSceneSec: 690,
    totalResponseSec: 843,
    resolution: 'QUOTA_COPAY',
    hospitalKm: 3.1,
    actor: 'DSP-0442',
  },
  {
    caseId: 'CASE-8760',
    ihsUid: 'IHS-ANTP-00011',
    patientName: 'Sita Mahalakshmi',
    fleetId: 'AMB-VSKP-12',
    driver: 'Suresh Naidu',
    triggeredAt: '2026-08-04 09:10',
    acceptedSec: 22,
    mobilizedSec: 75,
    onSceneSec: 505,
    totalResponseSec: 602,
    resolution: 'RESOLVED_HOME',
    hospitalKm: null,
    actor: 'DSP-0442',
  },
  {
    caseId: 'CASE-8744',
    ihsUid: 'IHS-ANTP-00003',
    patientName: 'Joseph D\'Souza',
    fleetId: 'AMB-VSKP-21',
    driver: 'Lakshmi Prasad',
    triggeredAt: '2026-08-03 21:30',
    acceptedSec: 90,
    mobilizedSec: 160,
    onSceneSec: 800,
    totalResponseSec: 1050,
    resolution: 'HOSPITAL_TRANSFER',
    hospitalKm: 6.8,
    actor: 'DSP-0310',
  },
  {
    caseId: 'CASE-8729',
    ihsUid: 'IHS-ANTP-00015',
    patientName: 'Ananya Krishnan',
    fleetId: 'AMB-VSKP-03',
    driver: 'Priya Devi',
    triggeredAt: '2026-08-03 13:05',
    acceptedSec: 40,
    mobilizedSec: 98,
    onSceneSec: 0,
    totalResponseSec: 138,
    resolution: 'CANCELLED',
    hospitalKm: null,
    actor: 'DSP-0442',
  },
];

export const AUDIT_LOG: AuditLogEntry[] = [
  {
    id: 'AUD-9912',
    at: '2026-08-06 14:25:11',
    event: 'DISPATCH_AUTHORIZED',
    actor: 'DSP-0442',
    ihsUid: 'IHS-ANTP-00001',
    detail: 'Fleet AMB-VSKP-07 mobilized · quota −1',
    hash: 'a3f91c…e2b1',
  },
  {
    id: 'AUD-9908',
    at: '2026-08-06 14:12:03',
    event: 'INBOUND_EMERGENCY_SOS',
    actor: 'SYSTEM',
    ihsUid: 'IHS-ANTP-00001',
    detail: 'Dual-pin OK · deviation 42m',
    hash: '91bb04…c771',
  },
  {
    id: 'AUD-9881',
    at: '2026-08-06 11:18:44',
    event: 'HOSPITAL_HANDOFF',
    actor: 'DSP-0442',
    ihsUid: 'IHS-ADMIN-00001',
    detail: 'Transfer to Care Hospital Ramnagar',
    hash: '55d0aa…19fe',
  },
  {
    id: 'AUD-9860',
    at: '2026-08-06 11:04:12',
    event: 'AMBER_OVERRIDE',
    actor: 'DSP-0442',
    ihsUid: 'IHS-ADMIN-00001',
    detail: 'Reason PHONE_VERIFIED · deviation 337m',
    hash: 'c0e812…44a0',
  },
  {
    id: 'AUD-9815',
    at: '2026-08-05 20:01:33',
    event: 'CASE_CLOSED_RESOLVED',
    actor: 'DSP-0442',
    ihsUid: 'IHS-ANTP-00018',
    detail: 'Doorstep resolved · WORM seal queued',
    hash: '7f2c11…90ad',
  },
  {
    id: 'AUD-9772',
    at: '2026-08-05 08:40:02',
    event: 'FALSE_ALARM_MARKED',
    actor: 'DSP-0310',
    ihsUid: 'IHS-ANTP-00007',
    detail: 'Patient confirmed accidental SOS',
    hash: 'de4410…bb23',
  },
  {
    id: 'AUD-9720',
    at: '2026-08-04 17:12:55',
    event: 'QUOTA_COPAY_AUTHORIZED',
    actor: 'DSP-0442',
    ihsUid: 'IHS-ANTP-00022',
    detail: '₹499 co-pay cleared · fleet released',
    hash: '118afe…6d90',
  },
  {
    id: 'AUD-9688',
    at: '2026-08-04 09:22:18',
    event: 'SYSTEM_ACCESS',
    actor: 'DSP-0442',
    ihsUid: 'DSP-0442',
    detail: 'Dispatcher console session opened',
    hash: 'ee90c2…1a45',
  },
];

export function computeStats(rows: DispatchHistoryRow[]) {
  const n = rows.length || 1;
  const avg = (pick: (r: DispatchHistoryRow) => number) =>
    Math.round(rows.reduce((s, r) => s + pick(r), 0) / n);

  const byResolution = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.resolution] = (acc[r.resolution] || 0) + 1;
    return acc;
  }, {});

  const slaUnder15 = rows.filter((r) => r.totalResponseSec > 0 && r.totalResponseSec <= 900).length;
  const completed = rows.filter((r) => r.resolution !== 'CANCELLED').length;

  return {
    totalCases: rows.length,
    avgAcceptSec: avg((r) => r.acceptedSec),
    avgMobilizeSec: avg((r) => r.mobilizedSec),
    avgOnSceneSec: avg((r) => (r.onSceneSec > 0 ? r.onSceneSec : 0)),
    avgTotalSec: avg((r) => r.totalResponseSec),
    slaUnder15Pct: Math.round((slaUnder15 / n) * 100),
    completionPct: Math.round((completed / n) * 100),
    byResolution,
  };
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function resolutionLabel(r: CaseResolution): string {
  return r.replace(/_/g, ' ');
}
