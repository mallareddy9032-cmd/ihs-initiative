// ============================================================================
// FILE: src/app/dispatcher/analytics/page.tsx
// CONTEXT: Analytics & Audit Log — response times, history, resolutions
// ============================================================================

'use client';

import React, { useMemo, useState } from 'react';
import { TopNav } from '@/components/ui/TopNav';
import {
  AUDIT_LOG,
  DISPATCH_HISTORY,
  computeStats,
  formatDuration,
  resolutionLabel,
  type CaseResolution,
} from '@/data/dispatchAnalytics';

const RESOLUTION_FILTERS: Array<'ALL' | CaseResolution> = [
  'ALL',
  'RESOLVED_HOME',
  'HOSPITAL_TRANSFER',
  'FALSE_ALARM',
  'QUOTA_COPAY',
  'CANCELLED',
];

export default function AnalyticsAuditPage() {
  const [resolutionFilter, setResolutionFilter] = useState<'ALL' | CaseResolution>('ALL');
  const [query, setQuery] = useState('');

  const filteredHistory = useMemo(() => {
    return DISPATCH_HISTORY.filter((row) => {
      if (resolutionFilter !== 'ALL' && row.resolution !== resolutionFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        row.caseId.toLowerCase().includes(q) ||
        row.ihsUid.toLowerCase().includes(q) ||
        row.patientName.toLowerCase().includes(q) ||
        row.fleetId.toLowerCase().includes(q)
      );
    });
  }, [resolutionFilter, query]);

  const stats = useMemo(() => computeStats(DISPATCH_HISTORY), []);
  const filteredAudit = useMemo(() => {
    if (!query.trim()) return AUDIT_LOG;
    const q = query.trim().toLowerCase();
    return AUDIT_LOG.filter(
      (e) =>
        e.event.toLowerCase().includes(q) ||
        e.ihsUid.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q),
    );
  }, [query]);

  const resolutionBars = useMemo(() => {
    const entries = Object.entries(stats.byResolution) as [CaseResolution, number][];
    const max = Math.max(...entries.map(([, n]) => n), 1);
    return entries.map(([key, count]) => ({
      key,
      count,
      pct: Math.round((count / max) * 100),
    }));
  }, [stats.byResolution]);

  return (
    <div className="flex h-screen w-full flex-col bg-[#F2F2F7] text-[#1C1C1E]">
      <TopNav
        operatorName="DISPATCHER"
        activeCases={0}
        connectionLabel="ANALYTICS"
        activePath="/dispatcher/analytics"
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          <header>
            <p className="text-[#FF2D55] text-xs font-black tracking-[0.2em]">COMMAND INTEL</p>
            <h1 className="text-2xl font-black mt-1">Analytics & Audit Log</h1>
            <p className="text-[#8E8E93] text-sm mt-1">
              Past case response times (T_A / T_M / on-scene), dispatch history, and resolution
              mix — last 7 days demo ledger.
            </p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Cases', value: String(stats.totalCases) },
              { label: 'Avg accept (T_A)', value: formatDuration(stats.avgAcceptSec) },
              { label: 'Avg mobilize (T_M)', value: formatDuration(stats.avgMobilizeSec) },
              { label: 'Avg on-scene', value: formatDuration(stats.avgOnSceneSec) },
              { label: 'Avg total response', value: formatDuration(stats.avgTotalSec) },
              { label: 'SLA ≤ 15 min', value: `${stats.slaUnder15Pct}%` },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-3xl border border-black/5 bg-white px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.03)]"
              >
                <div className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-bold">
                  {kpi.label}
                </div>
                <div className="text-xl font-black text-[#1C1C1E] mt-1 font-mono tabular-nums">
                  {kpi.value}
                </div>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <h2 className="text-sm font-black tracking-widest text-[#8E8E93] mb-3">
                RESOLUTION STATISTICS
              </h2>
              <div className="space-y-3">
                {resolutionBars.map((bar) => (
                  <div key={bar.key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#1C1C1E] font-semibold">
                        {resolutionLabel(bar.key)}
                      </span>
                      <span className="font-mono text-[#8E8E93] tabular-nums">
                        {bar.count} · {Math.round((bar.count / stats.totalCases) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F2F2F7] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#FF2D55] to-[#FF9500]"
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-4">
                Completion rate (non-cancelled):{' '}
                <span className="text-[#34C759] font-bold">{stats.completionPct}%</span>
              </p>
            </div>

            <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
              <h2 className="text-sm font-black tracking-widest text-[#8E8E93] mb-3">
                RESPONSE TIME PROFILE
              </h2>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-24 text-[#8E8E93] text-xs font-bold">Accept</div>
                  <div className="flex-1 h-3 rounded-full bg-[#F2F2F7] overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF]"
                      style={{ width: `${Math.min(100, (stats.avgAcceptSec / 120) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs tabular-nums">
                    {formatDuration(stats.avgAcceptSec)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-[#8E8E93] text-xs font-bold">Mobilize</div>
                  <div className="flex-1 h-3 rounded-full bg-[#F2F2F7] overflow-hidden">
                    <div
                      className="h-full bg-[#FF9500]"
                      style={{ width: `${Math.min(100, (stats.avgMobilizeSec / 180) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs tabular-nums">
                    {formatDuration(stats.avgMobilizeSec)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-[#8E8E93] text-xs font-bold">On-scene</div>
                  <div className="flex-1 h-3 rounded-full bg-[#F2F2F7] overflow-hidden">
                    <div
                      className="h-full bg-[#34C759]"
                      style={{ width: `${Math.min(100, (stats.avgOnSceneSec / 900) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs tabular-nums">
                    {formatDuration(stats.avgOnSceneSec)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 text-[#8E8E93] text-xs font-bold">Total</div>
                  <div className="flex-1 h-3 rounded-full bg-[#F2F2F7] overflow-hidden">
                    <div
                      className="h-full bg-[#FF2D55]"
                      style={{ width: `${Math.min(100, (stats.avgTotalSec / 1200) * 100)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs tabular-nums">
                    {formatDuration(stats.avgTotalSec)}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-[#8E8E93] mt-4">
                SLA target: doorstep contact ≤ 15 minutes from panic trigger.
              </p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search case / UID / patient / fleet…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-white border border-black/5 rounded-2xl px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15"
            />
            {RESOLUTION_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setResolutionFilter(f)}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full border ${
                  resolutionFilter === f
                    ? 'bg-[#007AFF] border-[#007AFF] text-white'
                    : 'bg-white border-black/5 text-[#8E8E93]'
                }`}
              >
                {f === 'ALL' ? 'All outcomes' : resolutionLabel(f)}
              </button>
            ))}
          </div>

          <section className="rounded-3xl border border-black/5 bg-white overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="px-4 py-3 border-b border-black/5 flex justify-between items-center">
              <h2 className="text-sm font-black tracking-widest text-[#8E8E93]">DISPATCH HISTORY</h2>
              <span className="text-[11px] text-[#8E8E93] font-mono tabular-nums">
                {filteredHistory.length} rows
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[900px]">
                <thead className="bg-[#F2F2F7] text-[#8E8E93] uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 font-bold">Case</th>
                    <th className="px-3 py-2 font-bold">Patient</th>
                    <th className="px-3 py-2 font-bold">Fleet</th>
                    <th className="px-3 py-2 font-bold">Triggered</th>
                    <th className="px-3 py-2 font-bold">Accept</th>
                    <th className="px-3 py-2 font-bold">Mobilize</th>
                    <th className="px-3 py-2 font-bold">On-scene</th>
                    <th className="px-3 py-2 font-bold">Total</th>
                    <th className="px-3 py-2 font-bold">Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((row) => (
                    <tr key={row.caseId} className="border-t border-black/5 hover:bg-[#F9F9FB]">
                      <td className="px-3 py-2.5 font-mono text-[#007AFF] tabular-nums">
                        {row.caseId}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[#1C1C1E]">{row.patientName}</div>
                        <div className="font-mono text-[#8E8E93]">{row.ihsUid}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-mono text-[#1C1C1E] tabular-nums">{row.fleetId}</div>
                        <div className="text-[#8E8E93]">{row.driver}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#8E8E93]">{row.triggeredAt}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {formatDuration(row.acceptedSec)}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {formatDuration(row.mobilizedSec)}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {formatDuration(row.onSceneSec)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-[#FF9500] tabular-nums">
                        {formatDuration(row.totalResponseSec)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#1C1C1E]">
                          {resolutionLabel(row.resolution)}
                        </span>
                        {row.hospitalKm != null && (
                          <div className="text-[#8E8E93] mt-1">{row.hospitalKm} km to hospital</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-[#8E8E93]">
                        No dispatch rows match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-black/5 bg-white overflow-hidden mb-8 shadow-[0_10px_30px_rgba(0,0,0,0.03)]">
            <div className="px-4 py-3 border-b border-black/5">
              <h2 className="text-sm font-black tracking-widest text-[#8E8E93]">WORM AUDIT LOG</h2>
              <p className="text-[11px] text-[#8E8E93] mt-1">
                Immutable event ledger · SHA-256 truncated hashes for demo
              </p>
            </div>
            <ul className="divide-y divide-black/5">
              {filteredAudit.map((entry) => (
                <li key={entry.id} className="px-4 py-3 flex flex-col sm:flex-row sm:gap-4">
                  <div className="sm:w-40 shrink-0 font-mono text-[11px] text-[#8E8E93]">
                    {entry.at}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-[#FF2D55] tracking-wide">
                        {entry.event}
                      </span>
                      <span className="text-[10px] font-mono text-[#8E8E93]">{entry.id}</span>
                    </div>
                    <p className="text-sm text-[#1C1C1E] mt-0.5">{entry.detail}</p>
                    <p className="text-[11px] text-[#8E8E93] mt-1 font-mono">
                      actor {entry.actor} · uid {entry.ihsUid} · hash {entry.hash}
                    </p>
                  </div>
                </li>
              ))}
              {filteredAudit.length === 0 && (
                <li className="px-4 py-8 text-center text-[#8E8E93] text-sm">
                  No audit events match this search.
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
