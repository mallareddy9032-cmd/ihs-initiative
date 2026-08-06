// ============================================================================
// FILE: src/components/fleet/FleetManagementSidebar.tsx
// CONTEXT: Command Center — active ambulances, drivers, hospital distance, assign
// ============================================================================

'use client';

import React, { useMemo, useState } from 'react';
import {
  FLEET_ROSTER,
  statusTone,
  type FleetDriverStatus,
  type FleetUnit,
} from '@/data/fleetRoster';

const FILTERS: { id: 'ALL' | FleetDriverStatus; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'AVAILABLE', label: 'Available' },
  { id: 'EN_ROUTE', label: 'En route' },
  { id: 'ON_SCENE', label: 'On scene' },
  { id: 'OFFLINE', label: 'Offline' },
];

interface FleetManagementSidebarProps {
  selectedFleetId: string | null;
  onAssign: (unit: FleetUnit) => void;
  onClearAssignment?: () => void;
  hasActiveSos: boolean;
  assignedForCase?: string | null;
}

export const FleetManagementSidebar: React.FC<FleetManagementSidebarProps> = ({
  selectedFleetId,
  onAssign,
  onClearAssignment,
  hasActiveSos,
  assignedForCase,
}) => {
  const [filter, setFilter] = useState<'ALL' | FleetDriverStatus>('ALL');
  const [alsOnly, setAlsOnly] = useState(false);

  const units = useMemo(() => {
    return FLEET_ROSTER.filter((u) => {
      if (filter !== 'ALL' && u.status !== filter) return false;
      if (alsOnly && !u.alsCapable) return false;
      return true;
    }).sort((a, b) => {
      const rank = (s: FleetDriverStatus) =>
        ({ AVAILABLE: 0, EN_ROUTE: 1, ON_SCENE: 2, RETURNING: 3, OFFLINE: 4 })[s];
      return rank(a.status) - rank(b.status) || a.hospitalDistanceKm - b.hospitalDistanceKm;
    });
  }, [filter, alsOnly]);

  const availableCount = FLEET_ROSTER.filter((u) => u.status === 'AVAILABLE').length;

  return (
    <aside className="w-full max-w-[340px] shrink-0 border-l border-black/5 bg-white/90 backdrop-blur-xl flex flex-col h-full min-h-0 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
      <div className="px-4 py-3 border-b border-black/5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black tracking-widest text-[#1C1C1E]">FLEET MANAGEMENT</h2>
          <span className="text-[10px] font-mono text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full">
            {availableCount} FREE
          </span>
        </div>
        <p className="text-xs text-[#8E8E93] mt-1">
          Active ambulances · driver status · hospital distance
        </p>
      </div>

      {assignedForCase && (
        <div className="mx-3 mt-3 rounded-2xl border border-[#FF2D55]/25 bg-[#FF2D55]/8 px-3 py-2 text-xs">
          <div className="font-bold text-[#FF2D55]">Assigned to case</div>
          <div className="font-mono text-[#1C1C1E] mt-0.5 tabular-nums">{assignedForCase}</div>
          {onClearAssignment && (
            <button
              type="button"
              onClick={onClearAssignment}
              className="mt-2 text-[11px] text-[#8E8E93] underline hover:text-[#1C1C1E]"
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
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
              filter === f.id
                ? 'bg-[#007AFF] border-[#007AFF] text-white'
                : 'bg-[#F2F2F7] border-transparent text-[#8E8E93] hover:text-[#1C1C1E]'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAlsOnly((v) => !v)}
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
            alsOnly
              ? 'bg-[#34C759] border-[#34C759] text-white'
              : 'bg-[#F2F2F7] border-transparent text-[#8E8E93]'
          }`}
        >
          ALS only
        </button>
      </div>

      {!hasActiveSos && (
        <div className="mx-3 mt-2 text-[11px] text-[#8E8E93] bg-[#F2F2F7] border border-black/5 rounded-2xl px-2 py-1.5">
          Select a unit now — it will auto-attach when you mobilize an SOS.
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
                  ? 'border-[#FF2D55]/40 bg-[#FF2D55]/6'
                  : 'border-black/5 bg-white hover:border-[#007AFF]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-bold text-[#1C1C1E] tabular-nums">
                    {unit.fleetId}
                  </div>
                  <div className="text-[11px] text-[#8E8E93]">
                    {unit.callSign} · {unit.vehicle}
                  </div>
                </div>
                <span
                  className={`text-[9px] font-black tracking-wide px-2 py-0.5 rounded-full ${statusTone(
                    unit.status,
                  )}`}
                >
                  {unit.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-2 text-xs text-[#8E8E93]">
                <div>
                  Driver: <span className="text-[#1C1C1E] font-semibold">{unit.driver}</span>
                </div>
                <div className="text-[#8E8E93] font-mono text-[10px]">{unit.driverPhone}</div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-2xl bg-[#F2F2F7] border border-black/5 px-2 py-1.5">
                  <div className="text-[#8E8E93] uppercase tracking-wide text-[9px]">Hospital</div>
                  <div className="text-[#1C1C1E] font-semibold leading-tight">{unit.hospitalName}</div>
                </div>
                <div className="rounded-2xl bg-[#F2F2F7] border border-black/5 px-2 py-1.5">
                  <div className="text-[#8E8E93] uppercase tracking-wide text-[9px]">Distance</div>
                  <div className="text-[#FF9500] font-bold tabular-nums">
                    {unit.hospitalDistanceKm.toFixed(1)} km
                  </div>
                  <div className="text-[#8E8E93] text-[10px]">ETA {unit.etaToHospitalMin} min</div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                {unit.alsCapable && (
                  <span className="text-[9px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
                    ALS
                  </span>
                )}
                <button
                  type="button"
                  disabled={!canAssign && !selected}
                  onClick={() => onAssign(unit)}
                  className={`ml-auto text-[11px] font-bold px-3 py-1.5 rounded-full ${
                    selected
                      ? 'bg-[#FF2D55] text-white'
                      : canAssign
                        ? 'bg-[#007AFF] hover:bg-[#0066d6] text-white'
                        : 'bg-[#F2F2F7] text-[#8E8E93] cursor-not-allowed'
                  }`}
                >
                  {selected ? 'ASSIGNED' : canAssign ? 'Assign vehicle' : 'Unavailable'}
                </button>
              </div>
            </div>
          );
        })}

        {units.length === 0 && (
          <div className="text-center text-[#8E8E93] text-xs py-8">No units match this filter.</div>
        )}
      </div>
    </aside>
  );
};
