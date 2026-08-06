// ============================================================================
// FILE: src/app/dispatcher/dashboard/page.tsx
// CONTEXT: Command Center - Live Emergency Routing & Capitation Gate
// ============================================================================

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { FsmEngineApi } from '@/services/api';
import { TopNav } from '@/components/ui/TopNav';
import { FleetManagementSidebar } from '@/components/fleet/FleetManagementSidebar';
import type { FleetUnit } from '@/data/fleetRoster';

const MapComponent = dynamic(
  () => import('@/components/map/MapComponent').then((m) => m.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#F2F2F7] text-[#8E8E93] font-mono text-sm">
        Loading map…
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
}

export default function CommandCenterDashboard() {
  const [activeSOS, setActiveSOS] = useState<SosPayload | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [quotaAlert, setQuotaAlert] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [selectedFleet, setSelectedFleet] = useState<FleetUnit | null>(null);
  const [fleetToast, setFleetToast] = useState<string | null>(null);

  const wsUrl =
    process.env.NEXT_PUBLIC_WS_DISPATCH_URL || 'ws://localhost:8080/v1/dispatch/stream';
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

  const { lastMessage, connectionState, error: wsError, reconnect } = useWebSocket(wsUrl);

  useEffect(() => {
    if (!fleetToast) return;
    const id = window.setTimeout(() => setFleetToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [fleetToast]);

  useEffect(() => {
    if (
      lastMessage?.event === 'DUAL_PIN_MISMATCH_ALERT' ||
      lastMessage?.event === 'INBOUND_EMERGENCY_SOS'
    ) {
      setActiveSOS(lastMessage.payload as SosPayload);
      setOverrideReason('');
      setDispatchError(null);
      setQuotaAlert(null);
      setSuccessBanner(null);
    }
    if (lastMessage?.event === 'DRIVER_STATUS_UPDATE') {
      const p = lastMessage.payload as {
        fleet_id?: string;
        label?: string;
        status?: string;
      };
      setFleetToast(
        `Driver update: ${p.fleet_id || 'UNIT'} · ${p.label || p.status || 'STATUS'}`,
      );
    }
    if (lastMessage?.event === 'ER_INTAKE_CONFIRMED') {
      const p = lastMessage.payload as {
        patient_name?: string;
        bay_id?: string;
        ihs_uid?: string;
      };
      setSuccessBanner(
        `ER INTAKE: ${p.patient_name || p.ihs_uid || 'Patient'} admitted · ${p.bay_id || 'bay'}`,
      );
    }
  }, [lastMessage]);

  const isAmberAlert = useMemo(
    () => !!activeSOS && activeSOS.deviation_meters > 100 && !activeSOS.is_proxy,
    [activeSOS]
  );

  const handleDispatch = async () => {
    if (!activeSOS) return;
    if (!selectedFleet) {
      setDispatchError('Assign a vehicle from the Fleet Management sidebar before mobilizing.');
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
      const result = await FsmEngineApi.attemptDispatch(
        activeSOS.ihs_uid,
        !!activeSOS.is_proxy,
        {
          caseId: activeSOS.case_id,
          patientInternalId: activeSOS.patient_internal_id,
          overrideReason: overrideReason || undefined,
          fleetId: selectedFleet.fleetId,
        }
      );

      if (result.requiresCoPay) {
        setQuotaAlert(
          `QUOTA EXCEEDED: Out-of-network charge of ₹${result.fee ?? 499} required to mobilize fleet.`
        );
        return;
      }

      const fleetLabel = result.fleetId || selectedFleet.fleetId;
      setSuccessBanner(
        `DISPATCH AUTHORIZED. ${fleetLabel} (${selectedFleet.driver}) → ${selectedFleet.hospitalName} · ${selectedFleet.hospitalDistanceKm.toFixed(1)} km.`
      );
      setActiveSOS(null);
      setSelectedFleet(null);
    } catch (error) {
      console.error('Dispatch failed', error);
      setDispatchError(
        error instanceof Error ? error.message : 'Dispatch failed. Retry or escalate.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

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
        throw new Error(
          typeof body.error === 'string' ? body.error : 'Failed to inject demo panic'
        );
      }
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : 'Inject failed');
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      <TopNav
        operatorName="DISPATCHER"
        activeCases={activeSOS ? 1 : 0}
        connectionLabel={`WSS: ${connectionState.toUpperCase()}`}
        activePath="/dispatcher/dashboard"
      />

      {(wsError ||
        connectionState === 'reconnecting' ||
        connectionState === 'closed' ||
        connectionState === 'error') && (
        <div
          role="alert"
          className="bg-[#FF2D55]/10 border-b border-[#FF2D55]/30 text-[#FF2D55] px-4 py-2 text-sm flex items-center justify-between gap-3"
        >
          <span>
            {wsError ||
              (connectionState === 'reconnecting'
                ? 'Dispatch stream reconnecting… Live SOS may pause.'
                : 'Dispatch stream offline — awaiting reconnect.')}
          </span>
          <button
            type="button"
            onClick={reconnect}
            className="underline font-bold text-[#FF9500] shrink-0"
          >
            Reconnect now
          </button>
        </div>
      )}

      {fleetToast && (
        <div role="status" className="bg-[#007AFF]/10 border-b border-[#007AFF]/25 text-[#007AFF] px-4 py-2 text-sm text-center font-semibold">
          {fleetToast}
        </div>
      )}

      {quotaAlert && (
        <div role="alert" className="bg-[#FF9500] text-white px-4 py-3 text-center font-bold">
          {quotaAlert}
        </div>
      )}

      {successBanner && (
        <div role="status" className="bg-[#34C759] text-white px-4 py-3 text-center font-bold">
          {successBanner}
        </div>
      )}

      {dispatchError && (
        <div role="alert" className="bg-[#FF2D55] text-white px-4 py-3 text-center font-bold">
          {dispatchError}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          {!activeSOS ? (
            <div className="flex flex-grow flex-col items-center justify-center bg-[#F9F9FB] text-[#1C1C1E] gap-4 px-6">
              <div className="font-bold text-2xl tracking-wide">AWAITING EMERGENCY SIGNALS...</div>
              <p className="text-[#8E8E93] font-mono text-sm text-center">
                Listening on {wsUrl} · status: {connectionState}
              </p>
              {(connectionState === 'connecting' || connectionState === 'reconnecting') && (
                <p className="text-[#FF9500] text-sm animate-pulse">
                  {connectionState === 'reconnecting'
                    ? 'Reconnecting to dispatch hub…'
                    : 'Connecting to dispatch hub…'}
                </p>
              )}
              {(connectionState === 'closed' || connectionState === 'error') && (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[#FF9500] text-sm text-center max-w-md">
                    Live feed unavailable. You can still assign fleet units; SOS inject resumes when
                    the stream is open.
                  </p>
                  <button
                    type="button"
                    onClick={reconnect}
                    className="text-sm font-bold underline text-[#007AFF]"
                  >
                    Retry connection
                  </button>
                </div>
              )}
              {connectionState === 'open' && (
                <button
                  type="button"
                  onClick={() => void injectDemoPanic()}
                  disabled={isInjecting}
                  className="mt-4 bg-[#FF2D55] hover:bg-[#E11D48] disabled:bg-[#F2F2F7] disabled:text-[#8E8E93] text-white px-6 py-3 rounded-2xl font-bold tracking-wide"
                >
                  {isInjecting ? 'INJECTING…' : 'SIMULATE PATIENT PANIC'}
                </button>
              )}
              <p className="text-gray-600 text-xs max-w-md text-center">
                Assign an ambulance from the Fleet Management sidebar, then simulate or await SOS.
                Analytics: use ANALYTICS in the header.
              </p>
            </div>
          ) : (
            <>
              {isAmberAlert && (
                <div className="bg-yellow-600 p-4 text-center font-bold text-black">
                  ⚠️ AMBER ALERT: Live GPS deviates {Math.round(activeSOS.deviation_meters)}m from
                  Registered Home Base.
                </div>
              )}

              <div className="relative flex-grow min-h-0">
                <MapComponent bluePin={activeSOS.home_gps} redPin={activeSOS.live_gps} />
              </div>

              <div className="bg-gray-800 p-6 flex justify-between items-center gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold">
                    Patient: {activeSOS.patient_name || activeSOS.ihs_uid}
                  </h2>
                  <p className="text-gray-300 text-sm font-mono">{activeSOS.ihs_uid}</p>
                  {activeSOS.case_id && (
                    <p className="text-gray-500 text-xs font-mono">Case {activeSOS.case_id}</p>
                  )}
                  {selectedFleet ? (
                    <p className="text-emerald-300 text-sm mt-1 font-semibold">
                      Vehicle: {selectedFleet.fleetId} · {selectedFleet.driver} ·{' '}
                      {selectedFleet.hospitalDistanceKm.toFixed(1)} km to{' '}
                      {selectedFleet.hospitalName}
                    </p>
                  ) : (
                    <p className="text-amber-300 text-sm mt-1">
                      No vehicle assigned — pick one in Fleet Management →
                    </p>
                  )}
                  <p className="text-gray-400 text-sm mt-1">
                    Live: {activeSOS.live_gps.lat.toFixed(5)}, {activeSOS.live_gps.lng.toFixed(5)} ·
                    Home: {activeSOS.home_gps.lat.toFixed(5)}, {activeSOS.home_gps.lng.toFixed(5)}
                  </p>
                  <p className="text-gray-400 text-sm">
                    Triggered: {new Date(activeSOS.timestamp).toLocaleTimeString()} ·{' '}
                    {activeSOS.connection_type || 'WIFI_LTE'}
                  </p>
                </div>

                <div className="flex gap-4 items-center flex-wrap">
                  {isAmberAlert && (
                    <select
                      className="bg-gray-700 p-3 rounded"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    >
                      <option value="">Select Verification Reason...</option>
                      <option value="PHONE_VERIFIED">Patient Verified by Phone</option>
                      <option value="KNOWN_GPS_DRIFT">Known Device GPS Drift</option>
                      <option value="NEIGHBOR_HOUSE">Patient at neighbor&apos;s house</option>
                    </select>
                  )}

                  <button
                    type="button"
                    className={`px-8 py-3 rounded font-bold ${
                      (isAmberAlert && !overrideReason) || isProcessing || !selectedFleet
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500'
                    }`}
                    disabled={
                      (isAmberAlert && !overrideReason) || isProcessing || !selectedFleet
                    }
                    onClick={() => void handleDispatch()}
                  >
                    {isProcessing
                      ? 'AUTHORIZING...'
                      : selectedFleet
                        ? `MOBILIZE ${selectedFleet.fleetId}`
                        : 'ASSIGN VEHICLE FIRST'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <FleetManagementSidebar
          selectedFleetId={selectedFleet?.fleetId ?? null}
          assignedForCase={selectedFleet?.fleetId ?? null}
          hasActiveSos={!!activeSOS}
          onAssign={(unit) => {
            setSelectedFleet(unit);
            setDispatchError(null);
            setFleetToast(
              `Vehicle ${unit.fleetId} assigned · ${unit.driver} · ${unit.hospitalDistanceKm.toFixed(1)} km to ${unit.hospitalName}`,
            );
          }}
          onClearAssignment={() => {
            setSelectedFleet(null);
            setFleetToast('Fleet assignment cleared.');
          }}
        />
      </div>
    </div>
  );
}
