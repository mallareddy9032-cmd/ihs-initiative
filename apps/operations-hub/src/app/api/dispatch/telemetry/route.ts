import { NextResponse } from 'next/server';
import { db } from '@ihs/db';

/**
 * GET /api/dispatch/telemetry
 * Live GIS feed — TriageCase rows joined with DispatchRecord positions.
 */
export async function GET() {
  const cases = await db.triageCase.findManyWithDispatch();
  const active = cases.filter(
    (row) => row.status === 'QUEUED' || row.status === 'DISPATCHED' || row.status === 'IN_PROGRESS',
  );

  // Simulate telemetry drift for EN_ROUTE units in mock mode.
  for (const row of active) {
    if (row.dispatch && row.dispatch.status === 'EN_ROUTE') {
      const jitterLat = (Math.random() - 0.5) * 0.0015;
      const jitterLng = (Math.random() - 0.5) * 0.0015;
      await db.dispatchRecord.touchTelemetry({
        id: row.dispatch.id,
        lat: row.dispatch.lat + jitterLat,
        lng: row.dispatch.lng + jitterLng,
        etaMins: Math.max(1, (row.dispatch.etaMins ?? 5) - 1),
        status: 'EN_ROUTE',
      });
    }
  }

  const refreshed = await db.triageCase.findManyWithDispatch();

  return NextResponse.json({
    mode: db.mode,
    generatedAt: new Date().toISOString(),
    center: { lat: 14.6819, lng: 77.6006, label: 'Ananthapuramu Core' },
    cases: refreshed.map((row) => ({
      id: row.id,
      ihsUid: row.ihsUid,
      serviceType: row.serviceType,
      status: row.status,
      priority: row.priority,
      sector: row.sector,
      latitude: row.latitude,
      longitude: row.longitude,
      patient: row.patient
        ? {
            ihsUid: row.patient.ihsUid,
            name: `${row.patient.firstName} ${row.patient.lastName}`,
          }
        : null,
      dispatch: row.dispatch
        ? {
            id: row.dispatch.id,
            fleetId: row.dispatch.fleetId,
            callsign: row.dispatch.callsign,
            status: row.dispatch.status,
            lat: row.dispatch.lat,
            lng: row.dispatch.lng,
            etaMins: row.dispatch.etaMins,
            lastTelemetryAt: row.dispatch.lastTelemetryAt.toISOString(),
          }
        : null,
    })),
  });
}
