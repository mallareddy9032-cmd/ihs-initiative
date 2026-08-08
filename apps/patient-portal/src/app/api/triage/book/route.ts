import { NextRequest, NextResponse } from 'next/server';
import { db, type TriageServiceType } from '@ihs/db';

const SERVICE_TYPES: readonly TriageServiceType[] = [
  'HOME_VISIT',
  'TELECONSULT',
  'EMERGENCY',
  'FOLLOW_UP',
];

function isServiceType(value: unknown): value is TriageServiceType {
  return typeof value === 'string' && (SERVICE_TYPES as readonly string[]).includes(value);
}

/**
 * POST /api/triage/book
 * Creates a TriageCase (and auto-assigns a DispatchRecord for GIS).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const ihsUid =
    typeof (body as { ihsUid?: unknown }).ihsUid === 'string'
      ? (body as { ihsUid: string }).ihsUid.trim().toUpperCase()
      : '';
  const serviceTypeRaw = (body as { serviceType?: unknown }).serviceType;
  const notes =
    typeof (body as { notes?: unknown }).notes === 'string'
      ? (body as { notes: string }).notes.trim()
      : null;
  const sector =
    typeof (body as { sector?: unknown }).sector === 'string'
      ? (body as { sector: string }).sector.trim()
      : 'Ananthapur Urban';
  const latitude =
    typeof (body as { latitude?: unknown }).latitude === 'number'
      ? (body as { latitude: number }).latitude
      : null;
  const longitude =
    typeof (body as { longitude?: unknown }).longitude === 'number'
      ? (body as { longitude: number }).longitude
      : null;

  if (!ihsUid) {
    return NextResponse.json({ error: 'ihsUid is required.' }, { status: 400 });
  }
  if (!isServiceType(serviceTypeRaw)) {
    return NextResponse.json(
      { error: `serviceType must be one of: ${SERVICE_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const triage = await db.triageCase.create({
    data: {
      ihsUid,
      serviceType: serviceTypeRaw,
      sector,
      latitude,
      longitude,
      notes,
      autoDispatch: true,
    },
  });

  return NextResponse.json(
    {
      mode: db.mode,
      triageCase: {
        id: triage.id,
        ihsUid: triage.ihsUid,
        serviceType: triage.serviceType,
        status: triage.status,
        priority: triage.priority,
        sector: triage.sector,
        latitude: triage.latitude,
        longitude: triage.longitude,
        notes: triage.notes,
        createdAt: triage.createdAt.toISOString(),
      },
      dispatch: triage.dispatch
        ? {
            id: triage.dispatch.id,
            fleetId: triage.dispatch.fleetId,
            callsign: triage.dispatch.callsign,
            status: triage.dispatch.status,
            lat: triage.dispatch.lat,
            lng: triage.dispatch.lng,
            etaMins: triage.dispatch.etaMins,
            lastTelemetryAt: triage.dispatch.lastTelemetryAt.toISOString(),
          }
        : null,
    },
    { status: 201 },
  );
}
