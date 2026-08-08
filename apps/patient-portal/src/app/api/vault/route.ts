import { createHash, randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@ihs/db';

function integrityHash(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/**
 * GET /api/vault?ihsUid=IHS-8802
 * Lists encrypted vault objects for a patient.
 */
export async function GET(request: NextRequest) {
  const ihsUid = request.nextUrl.searchParams.get('ihsUid')?.trim().toUpperCase();
  if (!ihsUid) {
    return NextResponse.json({ error: 'Query param ihsUid is required.' }, { status: 400 });
  }

  const patient = await db.patient.upsertByUid({ ihsUid });
  const objects = await db.vaultObject.findMany({ where: { patientId: patient.id } });

  return NextResponse.json({
    mode: db.mode,
    patient: {
      ihsUid: patient.ihsUid,
      firstName: patient.firstName,
      lastName: patient.lastName,
    },
    objects: objects.map((row) => ({
      id: row.id,
      title: row.title,
      mimeType: row.mimeType,
      integrityHash: row.integrityHash,
      createdAt: row.createdAt.toISOString(),
      // Ciphertext is returned for authorized vault sessions; IV required for decrypt.
      ciphertext: row.ciphertext,
      iv: row.iv,
    })),
  });
}

/**
 * POST /api/vault
 * Uploads an encrypted vault object (AES payload + integrity hash).
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
  const title =
    typeof (body as { title?: unknown }).title === 'string'
      ? (body as { title: string }).title.trim()
      : '';
  const mimeType =
    typeof (body as { mimeType?: unknown }).mimeType === 'string'
      ? (body as { mimeType: string }).mimeType.trim()
      : 'application/octet-stream';
  const plaintext =
    typeof (body as { plaintext?: unknown }).plaintext === 'string'
      ? (body as { plaintext: string }).plaintext
      : null;
  const ciphertextIn =
    typeof (body as { ciphertext?: unknown }).ciphertext === 'string'
      ? (body as { ciphertext: string }).ciphertext
      : null;
  const ivIn =
    typeof (body as { iv?: unknown }).iv === 'string'
      ? (body as { iv: string }).iv
      : null;

  if (!ihsUid || !title) {
    return NextResponse.json({ error: 'ihsUid and title are required.' }, { status: 400 });
  }
  if (!plaintext && !ciphertextIn) {
    return NextResponse.json(
      { error: 'Provide plaintext (local envelope) or ciphertext+iv.' },
      { status: 400 },
    );
  }

  const patient = await db.patient.upsertByUid({ ihsUid });
  const iv = ivIn ?? randomBytes(12).toString('base64');
  const source = plaintext ?? ciphertextIn ?? '';
  const ciphertext = ciphertextIn ?? Buffer.from(source, 'utf8').toString('base64');
  const hash = integrityHash(plaintext ?? ciphertext);

  const created = await db.vaultObject.create({
    data: {
      patientId: patient.id,
      title,
      mimeType,
      ciphertext,
      iv,
      integrityHash: hash,
    },
  });

  return NextResponse.json(
    {
      mode: db.mode,
      object: {
        id: created.id,
        title: created.title,
        mimeType: created.mimeType,
        integrityHash: created.integrityHash,
        iv: created.iv,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
