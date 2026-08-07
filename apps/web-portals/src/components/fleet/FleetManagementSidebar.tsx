// ============================================================================
// FILE: src/components/fleet/FleetManagementSidebar.tsx
// CONTEXT: Fleet telematics grid — Ananthapur pilot status categories
// ============================================================================

'use client';

import React, { useMemo, useState } from 'react';
import {
  FLEET_ROSTER,
  statusLabel,
  statusTone,
  type FleetDriverStatus,
  type FleetUnit,
} from '@/data/fleetRoster';

const FILTERS: { id: 'ALL' | FleetDriverStatus; label: string; emoji?: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AVAILABLE', label: 'Available', emoji: '🟢' },
  { id: 'EN_ROUTE', label: 'En Route', emoji: '🔵' },
  { id: 'ON_SCENE', label: 'On Scene', emoji: '🟡' },
  { id: 'TRANSPORTING', label: '→ ER', emoji: '🔴' },
];

interface FleetManagementSidebarProps {
  units?: FleetUnit[];
  selectedFleetId: string | null;
  onAssign: (unit: FleetUnit) => void;
  onClearAssignment?: () => void;
  hasActiveSos: boolean;
  assignedForCase?: string | null;
}

export const FleetManagementSidebar: React.FC<FleetManagementSidebarProps> = ({
  units: unitsProp,
  selectedFleetId,
  onAssign,
  onClearAssignment,
  hasActiveSos,
  assignedForCase,
}) => {
  const [filter, setFilter] = useState<'ALL' | FleetDriverStatus>('ALL');
  const [alsOnly, setAlsOnly] = useState(false);
  const roster = unitsProp ?? FLEET_ROSTER;

  const units = useMemo(() => {
    return roster.filter((u) => {
      if (filter !== 'ALL' && u.status !== filter) return false;
      if (alsOnly && !u.alsCapable) return false;
      return true;
    }).sort((a, b) => {
      const rank = (s: FleetDriverStatus) =>
        ({
          AVAILABLE: 0,
          EN_ROUTE: 1,
          ON_SCENE: 2,
          TRANSPORTING: 3,
          RETURNING: 4,
          OFFLINE: 5,
        })[s];
      return rank(a.status) - rank(b.status) || a.hospitalDistanceKm - b.hospitalDistanceKm;
    });
  }, [filter, alsOnly, roster]);

  const counts = useMemo(
    () => ({
      available: roster.filter((u) => u.status === 'AVAILABLE').length,
      enRoute: roster.filter((u) => u.status === 'EN_ROUTE').length,
      onScene: roster.filter((u) => u.status === 'ON_SCENE').length,
      transporting: roster.filter((u) => u.status === 'TRANSPORTING').length,
    }),
    [roster],
  );

  return (
    <aside className="w-full max-w-[320px] shrink-0 border-l border-black/5 bg-white/90 backdrop-blur-xl flex flex-col h-full min-h-0 shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      <div className="px-4 py-3 border-b border-black/5">
        <h2 className="font-serif text-xl text-[#1C1C1E]">Fleet Telematics</h2>
        <p className="text-xs text-[#6B6B70] mt-0.5">Vehicle status · Ananthapur pilot</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono-ops">
          <span className="rounded-full bg-[#0D5C4D]/10 text-[#0D5C4D] px-2 py-1">
            🟢 {counts.available} Available
          </span>
          <span className="rounded-full bg-[#2563EB]/10 text-[#2563EB] px-2 py-1">
            🔵 {counts.enRoute} En Route
          </span>
          <span className="rounded-full bg-[#D97706]/10 text-[#D97706] px-2 py-1">
            🟡 {counts.onScene} On Scene
          </span>
          <span className="rounded-full bg-[#DC2626]/10 text-[#DC2626] px-2 py-1">
            🔴 {counts.transporting} → ER
          </span>
        </div>
      </div>

      {assignedForCase && (
        <div className="mx-3 mt-3 rounded-2xl border border-[#0D5C4D]/25 bg-[#0D5C4D]/8 px-3 py-2 text-xs">
          <div className="font-bold text-[#0D5C4D]">Assigned to case</div>
          <div className="font-mono-ops text-[#1C1C1E] mt-0.5">{assignedForCase}</div>
          {onClearAssignment && (
            <button
              type="button"
              onClick={onClearAssignment}
              className="mt-2 text-[11px] text-[#6B6B70] underline hover:text-[#1C1C1E]"
            >
              Clear assignment
            </button>
          )}
        </div>
      )}

      <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-black/5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ios-press ${
              filter === f.id
                ? 'bg-[#0D5C4D] border-[#0D5C4D] text-white'
                : 'bg-[#FDFBF7] border-transparent text-[#6B6B70] hover:text-[#1C1C1E]'
            }`}
          >
            {f.emoji ? `${f.emoji} ` : ''}
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAlsOnly((v) => !v)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ios-press ${
            alsOnly
              ? 'bg-[#0D5C4D] border-[#0D5C4D] text-white'
              : 'bg-[#FDFBF7] border-transparent text-[#6B6B70]'
          }`}
        >
          ALS only
        </button>
      </div>

      {!hasActiveSos && (
        <div className="mx-3 mt-2 text-[11px] text-[#6B6B70] bg-[#FDFBF7] border border-black/5 rounded-2xl px-2 py-1.5">
          Select a unit — it attaches when you mobilize an SOS.
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {units.map((unit) => {
          const selected = selectedFleetId === unit.fleetId;
          const canAssign = unit.status === 'AVAILABLE' || unit.status === 'RETURNING';

          return (
            <div
              key={unit.fleetId}
              className={`rounded-3xl border p-3 transition-colors ${
                selected
                  ? 'border-[#0D5C4D]/40 bg-[#0D5C4D]/6'
                  : 'border-black/5 bg-white hover:border-[#0D5C4D]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono-ops text-sm font-bold text-[#1C1C1E]">{unit.fleetId}</div>
                  <div className="text-[11px] text-[#6B6B70]">
                    {unit.vehicleReg} · {unit.vehicle}
                  </div>
                </div>
                <span
                  className={`text-[9px] font-black tracking-wide px-2 py-0.5 rounded-full ${statusTone(
                    unit.status,
                  )}`}
                >
                  {statusLabel(unit.status)}
                </span>
              </div>

              <div className="mt-2 text-xs text-[#6B6B70]">
                <div>
                  Driver: <span className="text-[#1C1C1E] font-semibold">{unit.driver}</span>
                </div>
                <div className="font-mono-ops text-[10px]">
                  {unit.station} · {unit.speedKmh} km/h · HDG {unit.headingDeg}°
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-2xl bg-[#FDFBF7] border border-black/5 px-2 py-1.5">
                  <div className="text-[#6B6B70] uppercase tracking-wide text-[9px]">Hospital</div>
                  <div className="text-[#1C1C1E] font-semibold leading-tight">{unit.hospitalName}</div>
                </div>
                <div className="rounded-2xl bg-[#FDFBF7] border border-black/5 px-2 py-1.5">
                  <div className="text-[#6B6B70] uppercase tracking-wide text-[9px]">Distance</div>
                  <div className="text-[#D97706] font-bold font-mono-ops">
                    {unit.hospitalDistanceKm.toFixed(1)} km
                  </div>
                  <div className="text-[#6B6B70] text-[10px]">ETA {unit.etaToHospitalMin} min</div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {unit.alsCapable && (
                  <span className="text-[9px] font-bold text-[#0D5C4D] bg-[#0D5C4D]/10 px-2 py-0.5 rounded-full">
                    ALS
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canAssign && !selected}
                  onClick={() => onAssign(unit)}
                  className={`ml-auto text-[11px] font-bold px-3 py-1.5 rounded-full ios-press ${
                    selected
                      ? 'bg-[#0D5C4D] text-white'
                      : canAssign
                        ? 'bg-[#0D5C4D] hover:brightness-110 text-white'
                        : 'bg-[#F7F5F0] text-[#6B6B70] cursor-not-allowed'
                  }`}
                >
                  {selected ? 'ASSIGNED' : canAssign ? 'Assign' : 'Busy'}
                </button>
              </div>
            </div>
          );
        })}

        {units.length === 0 && (
          <div className="text-center text-[#6B6B70] text-xs py-8">No units match this filter.</div>
        )}
      </div>
    </aside>
  );
};
