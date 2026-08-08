import { NextRequest, NextResponse } from 'next/server';
import { db } from '@ihs/db';

type RxInput = {
  drugName: string;
  dosage: string;
  duration: string;
  instructions?: string | null;
};

function parsePrescriptions(raw: unknown): RxInput[] {
  if (!Array.isArray(raw)) return [];
  const out: RxInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const drugName =
      typeof (item as { drugName?: unknown }).drugName === 'string'
        ? (item as { drugName: string }).drugName.trim()
        : '';
    const dosage =
      typeof (item as { dosage?: unknown }).dosage === 'string'
        ? (item as { dosage: string }).dosage.trim()
        : '';
    const duration =
      typeof (item as { duration?: unknown }).duration === 'string'
        ? (item as { duration: string }).duration.trim()
        : '';
    const instructions =
      typeof (item as { instructions?: unknown }).instructions === 'string'
        ? (item as { instructions: string }).instructions.trim()
        : null;
    if (!drugName || !dosage || !duration) continue;
    out.push({ drugName, dosage, duration, instructions });
  }
  return out;
}

/**
 * GET /api/clinical/chart?clinicianUid=DOC-101
 */
export async function GET(request: NextRequest) {
  const clinicianUid = request.nextUrl.searchParams.get('clinicianUid')?.trim().toUpperCase();
  const charts = await db.clinicalChart.findMany(
    clinicianUid ? { where: { clinicianUid } } : undefined,
  );

  return NextResponse.json({
    mode: db.mode,
    charts: charts.map((chart) => ({
      id: chart.id,
      patientId: chart.patientId,
      triageCaseId: chart.triageCaseId,
      clinicianUid: chart.clinicianUid,
      subjective: chart.subjective,
      objective: chart.objective,
      assessment: chart.assessment,
      plan: chart.plan,
      createdAt: chart.createdAt.toISOString(),
      prescriptions: chart.prescriptions.map((rx) => ({
        id: rx.id,
        drugName: rx.drugName,
        dosage: rx.dosage,
        duration: rx.duration,
        instructions: rx.instructions,
        issuedAt: rx.issuedAt.toISOString(),
      })),
    })),
  });
}

/**
 * POST /api/clinical/chart
 * Writes SOAP notes + optional e-prescriptions.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const patientIhsUid =
    typeof (body as { patientIhsUid?: unknown }).patientIhsUid === 'string'
      ? (body as { patientIhsUid: string }).patientIhsUid.trim().toUpperCase()
      : '';
  const clinicianUid =
    typeof (body as { clinicianUid?: unknown }).clinicianUid === 'string'
      ? (body as { clinicianUid: string }).clinicianUid.trim().toUpperCase()
      : '';
  const triageCaseId =
    typeof (body as { triageCaseId?: unknown }).triageCaseId === 'string'
      ? (body as { triageCaseId: string }).triageCaseId.trim()
      : null;
  const subjective =
    typeof (body as { subjective?: unknown }).subjective === 'string'
      ? (body as { subjective: string }).subjective.trim()
      : '';
  const objective =
    typeof (body as { objective?: unknown }).objective === 'string'
      ? (body as { objective: string }).objective.trim()
      : '';
  const assessment =
    typeof (body as { assessment?: unknown }).assessment === 'string'
      ? (body as { assessment: string }).assessment.trim()
      : '';
  const plan =
    typeof (body as { plan?: unknown }).plan === 'string'
      ? (body as { plan: string }).plan.trim()
      : '';

  if (!patientIhsUid || !clinicianUid) {
    return NextResponse.json(
      { error: 'patientIhsUid and clinicianUid are required.' },
      { status: 400 },
    );
  }
  if (!subjective || !objective || !assessment || !plan) {
    return NextResponse.json(
      { error: 'SOAP fields subjective, objective, assessment, and plan are required.' },
      { status: 400 },
    );
  }

  const chart = await db.clinicalChart.create({
    data: {
      patientIhsUid,
      clinicianUid,
      triageCaseId,
      subjective,
      objective,
      assessment,
      plan,
      prescriptions: parsePrescriptions((body as { prescriptions?: unknown }).prescriptions),
    },
  });

  return NextResponse.json(
    {
      mode: db.mode,
      chart: {
        id: chart.id,
        patientId: chart.patientId,
        triageCaseId: chart.triageCaseId,
        clinicianUid: chart.clinicianUid,
        subjective: chart.subjective,
        objective: chart.objective,
        assessment: chart.assessment,
        plan: chart.plan,
        createdAt: chart.createdAt.toISOString(),
        prescriptions: chart.prescriptions,
      },
    },
    { status: 201 },
  );
}
