// ============================================================================
// FILE: src/app/dispatcher/dashboard/page.tsx
// CONTEXT: Granola × Nuraform Command Center — Ananthapur GIS HUD
// ============================================================================

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FsmEngineApi, MlcApi } from '@/services/api';
import { TopNav } from '@/components/ui/TopNav';
import { FleetManagementSidebar } from '@/components/fleet/FleetManagementSidebar';
import { FLEET_ROSTER, type FleetUnit } from '@/data/fleetRoster';
import { MlcScreeningGate } from '@/components/dispatch/MlcScreeningGate';

const MapComponent = dynamic(
  () => import('@/components/map/MapComponent').then((m) => m.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#0F172A] text-[#94A3B8] font-mono-ops text-sm rounded-3xl">
        Loading GIS HUD…
      </div>
    ),
  },
);

interface SosPayload {
  ihs_uid: string;
  patient_name?: string;
  patient_internal_id?: string;
  case_id?: string;
  is_proxy?: boolean;
  deviation_meters: number;
  warning_level?: string | null;
  action_required?: string;
  live_gps: { lat: number; lng: number };
  home_gps: { lat: number; lng: number };
  timestamp: string;
  connection_type?: string;
  sector?: string;
  hr?: number;
  spo2?: number;
  chief_complaint?: string;
}

interface TriageIncident {
  id: string;
  patientName: string;
  ihsUid: string;
  sector: string;
  lat: number;
  lng: number;
  homeLat: number;
  homeLng: number;
  tatSeconds: number;
  hr: number;
  spo2: number;
  chiefComplaint: string;
  source: 'live' | 'demo';
  raw?: SosPayload;
}

interface AuditEvent {
  id: string;
  ts: string;
  line: string;
}

const DEMO_INCIDENTS: TriageIncident[] = [
  {
    id: 'demo-8802',
    patientName: 'Lakshmi R.',
    ihsUid: 'IHS-8802',
    sector: 'Ananthapur Urban · Sector 04',
    lat: 14.6842,
    lng: 77.6051,
    homeLat: 14.6819,
    homeLng: 77.6006,
    tatSeconds: 4 * 60 + 18,
    hr: 118,
    spo2: 94,
    chiefComplaint: 'Chest pain · suspected ACS',
    source: 'demo',
  },
  {
    id: 'demo-7741',
    patientName: 'Suresh N.',
    ihsUid: 'IHS-7741',
    sector: 'Dharmavaram · Sector 02',
    lat: 14.418,
    lng: 77.715,
    homeLat: 14.414,
    homeLng: 77.72,
    tatSeconds: 3 * 60 + 52,
    hr: 102,
    spo2: 96,
    chiefComplaint: 'Acute dyspnea · elderly',
    source: 'demo',
  },
];

function formatTat(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function nowStamp(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function cloneRoster(): FleetUnit[] {
  return FLEET_ROSTER.map((u) => ({ ...u }));
}

export default function CommandCenterDashboard() {
  const [incidents, setIncidents] = useState<TriageIncident[]>(DEMO_INCIDENTS);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    DEMO_INCIDENTS[0]?.id ?? null,
  );
  const [overrideReason, setOverrideReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  const [fleetUnits, setFleetUnits] = useState<FleetUnit[]>(cloneRoster);
  const [fleetToast, setFleetToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [auditOpen, setAuditOpen] = useState(true);
  const [mlcClearedFor, setMlcClearedFor] = useState<string | null>(null);
  const [mlcLocked, setMlcLocked] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([
    {
      id: 'seed-1',
      ts: nowStamp(),
      line: 'SOS_TRIGGERED -> Patient #IHS-8802 -> Ananthapur Sector 04',
    },
    {
      id: 'seed-2',
      ts: nowStamp(),
      line: 'DISPATCH_ACK -> Unit #ALS-01 -> Driver Dispatched (ETA 03:40m)',
    },
    {
      id: 'seed-3',
      ts: nowStamp(),
      line: 'GIS_HUD_SYNC -> Pilot nodes ONLINE · Ananthapur 50km radius',
    },
  ]);

  const wsUrl =
    process.env.NEXT_PUBLIC_WS_DISPATCH_URL || 'ws://localhost:8080/v1/dispatch/stream';
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

  const { lastMessage, connectionState, error: wsError, reconnect } = useWebSocket(wsUrl);

  const pushAudit = useCallback((line: string) => {
    setAuditLog((prev) =>
      [{ id: `${Date.now()}-${Math.random()}`, ts: nowStamp(), line }, ...prev].slice(0, 40),
    );
  }, []);

  const selectedFleet = useMemo(
    () => fleetUnits.find((u) => u.fleetId === selectedFleetId) ?? null,
    [fleetUnits, selectedFleetId],
  );

  useEffect(() => {
    if (!fleetToast) return;
    const id = window.setTimeout(() => setFleetToast(null), 4200);
    return () => window.clearTimeout(id);
  }, [fleetToast]);

  useEffect(() => {
    if (!successBanner) return;
    const id = window.setTimeout(() => setSuccessBanner(null), 5000);
    return () => window.clearTimeout(id);
  }, [successBanner]);

  useEffect(() => {
    if (!dispatchError) return;
    const id = window.setTimeout(() => setDispatchError(null), 6000);
    return () => window.clearTimeout(id);
  }, [dispatchError]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIncidents((prev) =>
        prev.map((inc) => ({ ...inc, tatSeconds: Math.max(0, inc.tatSeconds - 1) })),
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (
      lastMessage?.event === 'DUAL_PIN_MISMATCH_ALERT' ||
      lastMessage?.event === 'INBOUND_EMERGENCY_SOS'
    ) {
      const p = lastMessage.payload as SosPayload;
      const incident: TriageIncident = {
        id: p.case_id || `live-${p.ihs_uid}-${Date.now()}`,
        patientName: p.patient_name || p.ihs_uid,
        ihsUid: p.ihs_uid,
        sector: p.sector || 'Ananthapur Urban · Sector 04',
        lat: p.live_gps.lat,
        lng: p.live_gps.lng,
        homeLat: p.home_gps.lat,
        homeLng: p.home_gps.lng,
        tatSeconds: 4 * 60 + 30,
        hr: p.hr ?? 110,
        spo2: p.spo2 ?? 95,
        chiefComplaint: p.chief_complaint || '1-Tap SOS · clinical triage pending',
        source: 'live',
        raw: p,
      };
      setIncidents((prev) => [
        incident,
        ...prev.filter((i) => i.ihsUid !== p.ihs_uid || i.source === 'demo'),
      ]);
      setSelectedIncidentId(incident.id);
      setOverrideReason('');
      setDispatchError(null);
      setQuotaAlert(null);
      setSuccessBanner(null);
      pushAudit(`SOS_TRIGGERED -> Patient #${p.ihs_uid} -> ${incident.sector}`);
      if (audioEnabled) {
        try {
          const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.value = 880;
          gain.gain.value = 0.04;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch {
          // ignore audio failures
        }
      }
    }
    if (lastMessage?.event === 'DRIVER_STATUS_UPDATE') {
      const p = lastMessage.payload as { fleet_id?: string; label?: string; status?: string };
      setFleetToast(`Driver update: ${p.fleet_id || 'UNIT'} · ${p.label || p.status || 'STATUS'}`);
      pushAudit(`DRIVER_STATUS -> ${p.fleet_id || 'UNIT'} -> ${p.label || p.status || 'UPDATE'}`);
    }
    if (lastMessage?.event === 'ER_INTAKE_CONFIRMED') {
      const p = lastMessage.payload as { patient_name?: string; bay_id?: string; ihs_uid?: string };
      setSuccessBanner(
        `ER INTAKE: ${p.patient_name || p.ihs_uid || 'Patient'} admitted · ${p.bay_id || 'bay'}`,
      );
      pushAudit(`ER_INTAKE -> ${p.ihs_uid || 'Patient'} -> ${p.bay_id || 'trauma bay'}`);
    }
    if (lastMessage?.event === 'SAFE_HARBOR_MLC') {
      const p = lastMessage.payload as {
        case_id?: string;
        ihs_uid?: string;
        statutory?: { primary?: string; secondary?: string };
      };
      setMlcLocked(true);
      setQuotaAlert(
        `MLC SAFE HARBOR — Patch to ${p.statutory?.primary || '108'} / ${p.statutory?.secondary || '112'} NOW. IHS fleet locked.`,
      );
      pushAudit(
        `SAFE_HARBOR_MLC -> ${p.ihs_uid || p.case_id || 'case'} -> statutory ${p.statutory?.primary || '108'}/${p.statutory?.secondary || '112'}`,
      );
    }
  }, [lastMessage, pushAudit, audioEnabled]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? incidents[0] ?? null,
    [incidents, selectedIncidentId],
  );

  const isAmberAlert = useMemo(() => {
    if (!selectedIncident?.raw) return false;
    return selectedIncident.raw.deviation_meters > 100 && !selectedIncident.raw.is_proxy;
  }, [selectedIncident]);

  const mobilizedCount = useMemo(
    () => fleetUnits.filter((u) => u.status !== 'AVAILABLE' && u.status !== 'OFFLINE').length,
    [fleetUnits],
  );

  const assignFleet = useCallback(
    (unit: FleetUnit, source: 'auto' | 'manual') => {
      setSelectedFleetId(unit.fleetId);
      setDispatchError(null);
      const label =
        source === 'auto'
          ? `Auto-assigned ${unit.fleetId} · ${unit.driver} · ${unit.station}`
          : `Vehicle ${unit.fleetId} assigned · ${unit.driver} · ${unit.station}`;
      setFleetToast(label);
      pushAudit(
        `${source === 'auto' ? 'AUTO_ASSIGN' : 'MANUAL_ASSIGN'} -> Unit #${unit.fleetId} -> ${unit.driver}`,
      );
    },
    [pushAudit],
  );

  const handleAutoAssign = () => {
    const nearest = [...fleetUnits]
      .filter((u) => u.status === 'AVAILABLE' && u.alsCapable)
      .sort((a, b) => a.hospitalDistanceKm - b.hospitalDistanceKm)[0];
    if (!nearest) {
      setDispatchError('No ALS units available in the pilot grid.');
      return;
    }
    assignFleet(nearest, 'auto');
  };

  const handleDispatch = async () => {
    if (!selectedIncident) return;
    if (mlcLocked || mlcClearedFor !== selectedIncident.id) {
      setDispatchError(
        mlcLocked
          ? 'MLC locked — patch to 108/112. IHS fleet dispatch blocked.'
          : 'Complete MLC screening before mobilizing IHS fleet.',
      );
      return;
    }
    if (!selectedFleet) {
      setDispatchError('Assign a vehicle before mobilizing.');
      return;
    }
    if (isAmberAlert && !overrideReason.trim()) {
      setDispatchError('Select a verification reason before mobilizing an Amber Alert case.');
      return;
    }

    setIsProcessing(true);
    setDispatchError(null);
    setQuotaAlert(null);
    setSuccessBanner(null);

    try {
      if (selectedIncident.source === 'live' && selectedIncident.raw) {
        const result = await FsmEngineApi.attemptDispatch(
          selectedIncident.ihsUid,
          !!selectedIncident.raw.is_proxy,
          {
            caseId: selectedIncident.raw.case_id,
            patientInternalId: selectedIncident.raw.patient_internal_id,
            overrideReason: overrideReason || undefined,
            fleetId: selectedFleet.fleetId,
          },
        );

        if (result.requiresCoPay) {
          setQuotaAlert(
            `QUOTA EXCEEDED: Out-of-network charge of ₹${result.fee ?? 499} required to mobilize fleet.`,
          );
          return;
        }
      }

      const eta = formatTat(selectedIncident.tatSeconds);
      const fleetId = selectedFleet.fleetId;
      setFleetUnits((prev) =>
        prev.map((u) =>
          u.fleetId === fleetId
            ? { ...u, status: 'EN_ROUTE', speedKmh: Math.max(u.speedKmh, 36) }
            : u,
        ),
      );
      setSuccessBanner(
        `DISPATCH AUTHORIZED. ${fleetId} (${selectedFleet.driver}) → ${selectedFleet.hospitalName}.`,
      );
      pushAudit(`DISPATCH_ACK -> Unit #${fleetId} -> Driver Dispatched (ETA ${eta}m)`);
      setIncidents((prev) => prev.filter((i) => i.id !== selectedIncident.id));
      setSelectedIncidentId(null);
      setSelectedFleetId(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Dispatch failed. Retry or escalate.';
      if (msg.includes('MLC_STATUTORY_REDIRECT') || msg.includes('medico-legal')) {
        setMlcLocked(true);
        setQuotaAlert('MLC STATUTORY REDIRECT — Patch to 108/112. Fleet blocked.');
        pushAudit(`MLC_BLOCK -> fleet dispatch rejected -> 108/112`);
      }
      console.error('Dispatch failed', error);
      setDispatchError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const addLocalPanic = useCallback(
    (reason: string) => {
      const fallback: TriageIncident = {
        id: `demo-${Date.now()}`,
        patientName: 'Ramu M.',
        ihsUid: 'IHS-ADMIN-00001',
        sector: 'Ananthapur Urban · Sector 01',
        lat: 14.6835,
        lng: 77.602,
        homeLat: 14.6819,
        homeLng: 77.6006,
        tatSeconds: 4 * 60 + 55,
        hr: 124,
        spo2: 93,
        chiefComplaint: '1-Tap SOS · simulated panic',
        source: 'demo',
      };
      setIncidents((prev) => {
        if (prev.some((i) => i.ihsUid === fallback.ihsUid && i.tatSeconds > 4 * 60 + 40)) {
          return prev;
        }
        return [fallback, ...prev];
      });
      setSelectedIncidentId(fallback.id);
      pushAudit(`SOS_TRIGGERED -> Patient #${fallback.ihsUid} -> ${fallback.sector} (${reason})`);
      setFleetToast(`New SOS queued · ${fallback.ihsUid} · ${fallback.sector}`);
    },
    [pushAudit],
  );

  const injectDemoPanic = async () => {
    setIsInjecting(true);
    setDispatchError(null);
    try {
      const response = await fetch(`${apiBase}/v1/demo/inject-panic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ihs_uid: 'IHS-ADMIN-00001' }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body.error === 'string' ? body.error : 'Failed to inject demo panic');
      }
      pushAudit('DEMO_INJECT -> Patient #IHS-ADMIN-00001 -> Panic simulation fired');
      // Mirror locally so the queue responds even if WS is delayed/offline
      window.setTimeout(() => addLocalPanic('engine inject + local mirror'), 400);
    } catch {
      addLocalPanic('local demo');
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col text-[#1C1C1E]">
      <TopNav
        operatorName="Dispatcher Desk #04"
        activeCases={incidents.length}
        mobilizedUnits={mobilizedCount}
        avgTatLabel="03:42 mins"
        connectionLabel={`WSS: ${connectionState.toUpperCase()}`}
        activePath="/dispatcher/dashboard"
        audioEnabled={audioEnabled}
        onToggleAudio={() => {
          setAudioEnabled((v) => {
            const next = !v;
            setFleetToast(next ? 'Audio alerts ACTIVE' : 'Audio alerts MUTED');
            return next;
          });
        }}
      />

      {(wsError ||
        connectionState === 'reconnecting' ||
        connectionState === 'closed' ||
        connectionState === 'error') && (
        <div
          role="alert"
          className="mx-3 mb-1 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/25 text-[#DC2626] px-4 py-2 text-sm flex items-center justify-between gap-3"
        >
          <span>
            {wsError ||
              (connectionState === 'reconnecting'
                ? 'Dispatch stream reconnecting… Live SOS may pause.'
                : 'Dispatch stream offline — demo triage queue remains active.')}
          </span>
          <button
            type="button"
            onClick={reconnect}
            className="underline font-bold text-[#D97706] shrink-0"
          >
            Reconnect
          </button>
        </div>
      )}

      {fleetToast && (
        <div
          role="status"
          className="mx-3 mb-1 rounded-2xl bg-[#0D5C4D]/10 border border-[#0D5C4D]/20 text-[#0D5C4D] px-4 py-2 text-sm text-center font-semibold"
        >
          {fleetToast}
        </div>
      )}
      {quotaAlert && (
        <div
          role="alert"
          className="mx-3 mb-1 rounded-2xl bg-[#D97706] text-white px-4 py-2 text-center font-bold text-sm"
        >
          {quotaAlert}
        </div>
      )}
      {successBanner && (
        <div
          role="status"
          className="mx-3 mb-1 rounded-2xl bg-[#0D5C4D] text-white px-4 py-2 text-center font-bold text-sm"
        >
          {successBanner}
        </div>
      )}
      {dispatchError && (
        <div
          role="alert"
          className="mx-3 mb-1 rounded-2xl bg-[#DC2626] text-white px-4 py-2 text-center font-bold text-sm"
        >
          {dispatchError}
        </div>
      )}

      <div className="flex flex-1 min-h-0 px-3 pb-2 gap-3">
        <aside className="w-[320px] shrink-0 flex flex-col min-h-0 cmd-card overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5">
            <h2 className="font-serif text-xl text-[#1C1C1E]">Active Grid Incidents</h2>
            <p className="text-xs text-[#6B6B70] mt-0.5">Priority triage · TAT &lt; 5:00</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {incidents.length === 0 ? (
              <div className="text-center py-10 px-3">
                <p className="font-serif text-lg text-[#1C1C1E]">Awaiting emergency signals</p>
                <p className="text-xs text-[#6B6B70] font-mono-ops mt-2">
                  Listening · {connectionState}
                </p>
                <button
                  type="button"
                  onClick={() => void injectDemoPanic()}
                  disabled={isInjecting}
                  className="mt-4 bg-[#DC2626] hover:brightness-110 text-white px-4 py-2.5 rounded-full text-xs font-bold ios-press"
                >
                  {isInjecting ? 'INJECTING…' : 'SIMULATE PATIENT PANIC'}
                </button>
              </div>
            ) : (
              incidents.map((inc) => {
                const active = selectedIncident?.id === inc.id;
                const critical = inc.tatSeconds < 60;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(inc.id)}
                    className={`w-full text-left rounded-3xl border p-3 transition-colors ${
                      active
                        ? 'border-[#DC2626]/40 bg-[#DC2626]/6'
                        : 'border-black/5 bg-white hover:border-[#0D5C4D]/25'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-[#1C1C1E]">{inc.patientName}</div>
                        <div className="font-mono-ops text-[10px] text-[#6B6B70]">{inc.ihsUid}</div>
                      </div>
                      <div
                        className={`font-mono-ops text-sm font-black tabular-nums ${
                          critical ? 'text-[#DC2626]' : 'text-[#D97706]'
                        }`}
                      >
                        {formatTat(inc.tatSeconds)}
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-[#6B6B70]">{inc.sector}</div>
                    <div className="mt-1 font-mono-ops text-[10px] text-[#6B6B70]">
                      {inc.lat.toFixed(4)}° N · {inc.lng.toFixed(4)}° E
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="rounded-xl bg-[#FDFBF7] border border-black/5 px-1.5 py-1">
                        <div className="text-[#6B6B70]">HR</div>
                        <div className="font-bold font-mono-ops text-[#DC2626]">{inc.hr}</div>
                      </div>
                      <div className="rounded-xl bg-[#FDFBF7] border border-black/5 px-1.5 py-1">
                        <div className="text-[#6B6B70]">SpO₂</div>
                        <div className="font-bold font-mono-ops text-[#0D5C4D]">{inc.spo2}%</div>
                      </div>
                      <div className="rounded-xl bg-[#FDFBF7] border border-black/5 px-1.5 py-1">
                        <div className="text-[#6B6B70]">CC</div>
                        <div
                          className="font-semibold text-[#1C1C1E] leading-tight truncate"
                          title={inc.chiefComplaint}
                        >
                          {inc.chiefComplaint.split('·')[0]}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedIncident && (
            <div className="border-t border-black/5 p-3 space-y-2 bg-[#FDFBF7]/80">
              <MlcScreeningGate
                patientLabel={`${selectedIncident.patientName} · ${selectedIncident.ihsUid}`}
                onCleared={() => {
                  setMlcClearedFor(selectedIncident.id);
                  setMlcLocked(false);
                  setFleetToast('MLC screening cleared — IHS fleet board unlocked');
                  pushAudit(`MLC_CLEARED -> ${selectedIncident.ihsUid} -> IHS ALS permitted`);
                }}
                onStatutoryRedirect={({ dial108, dial112 }) => {
                  setMlcLocked(true);
                  setMlcClearedFor(null);
                  setQuotaAlert(
                    `MLC PROTOCOL — Patching to ${dial108}/${dial112}. IHS fleet hard-locked.`,
                  );
                  pushAudit(
                    `MLC_SCREEN_YES -> ${selectedIncident.ihsUid} -> statutory ${dial108}/${dial112}`,
                  );
                  void MlcApi.screeningRedirect({
                    caseId: selectedIncident.raw?.case_id,
                    ihsUid: selectedIncident.ihsUid,
                    patientName: selectedIncident.patientName,
                    chiefComplaint: selectedIncident.chiefComplaint,
                    liveGps: { lat: selectedIncident.lat, lng: selectedIncident.lng },
                    createCase: !selectedIncident.raw?.case_id,
                  }).catch((err) => {
                    console.warn('MLC screening API', err);
                  });
                }}
              />
              {mlcClearedFor === selectedIncident.id && !mlcLocked ? (
                <>
                  {selectedFleet && (
                    <div className="rounded-2xl border border-[#0D5C4D]/25 bg-[#0D5C4D]/8 px-3 py-2 text-[11px]">
                      <span className="font-bold text-[#0D5C4D]">Ready to mobilize · </span>
                      <span className="font-mono-ops text-[#1C1C1E]">
                        {selectedFleet.fleetId} · {selectedFleet.driver}
                      </span>
                    </div>
                  )}
                  {isAmberAlert && (
                    <select
                      className="w-full bg-white border border-black/8 rounded-2xl p-2.5 text-xs"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    >
                      <option value="">Select verification reason…</option>
                      <option value="PHONE_VERIFIED">Patient Verified by Phone</option>
                      <option value="KNOWN_GPS_DRIFT">Known Device GPS Drift</option>
                      <option value="NEIGHBOR_HOUSE">Patient at neighbor&apos;s house</option>
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={handleAutoAssign}
                    className="w-full bg-[#0D5C4D] text-white rounded-full py-2.5 text-xs font-bold ios-press"
                  >
                    ⚡ Auto-Assign Nearest ALS Unit
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing || !selectedFleet || (isAmberAlert && !overrideReason)}
                    onClick={() => void handleDispatch()}
                    className={`w-full rounded-full py-2.5 text-xs font-bold ios-press ${
                      isProcessing || !selectedFleet || (isAmberAlert && !overrideReason)
                        ? 'bg-[#E8E4DC] text-[#6B6B70] cursor-not-allowed'
                        : 'bg-white border border-[#0D5C4D]/30 text-[#0D5C4D]'
                    }`}
                  >
                    {isProcessing
                      ? 'AUTHORIZING…'
                      : selectedFleet
                        ? `Mobilize ${selectedFleet.fleetId}`
                        : 'Assign vehicle first'}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => void injectDemoPanic()}
                disabled={isInjecting}
                className="w-full text-[11px] font-bold text-[#DC2626] underline"
              >
                {isInjecting ? 'Injecting…' : 'Simulate additional SOS'}
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
          <div className="flex-1 min-h-[280px]">
            <MapComponent
              bluePin={
                selectedIncident
                  ? { lat: selectedIncident.homeLat, lng: selectedIncident.homeLng }
                  : { lat: 14.6819, lng: 77.6006 }
              }
              redPin={
                selectedIncident
                  ? { lat: selectedIncident.lat, lng: selectedIncident.lng }
                  : null
              }
              fleet={fleetUnits}
              center={{ lat: 14.6819, lng: 77.6006 }}
            />
          </div>

          <div className="cmd-card overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setAuditOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-black/5"
              aria-expanded={auditOpen}
            >
              <div>
                <span className="font-serif text-base text-[#1C1C1E]">WebSocket Event Stream</span>
                <span className="ml-2 text-[10px] font-mono-ops text-[#0D5C4D]">sub-50ms audit</span>
              </div>
              <span className="text-xs font-bold text-[#6B6B70]">
                {auditOpen ? '▾ Collapse' : '▸ Expand'}
              </span>
            </button>
            {auditOpen && (
              <div className="max-h-[140px] overflow-y-auto px-4 py-2 space-y-1 bg-[#1C1C1E]">
                {auditLog.map((ev) => (
                  <div
                    key={ev.id}
                    className="font-mono-ops text-[11px] text-[#A7F3D0] leading-relaxed"
                  >
                    <span className="text-[#64748B]">[{ev.ts}]</span> {ev.line}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <FleetManagementSidebar
          units={fleetUnits}
          selectedFleetId={selectedFleetId}
          assignedForCase={selectedFleetId}
          hasActiveSos={incidents.length > 0}
          onAssign={(unit) => assignFleet(unit, 'manual')}
          onClearAssignment={() => {
            setSelectedFleetId(null);
            setFleetToast('Fleet assignment cleared.');
          }}
        />
      </div>
    </div>
  );
}
