import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_TTL_SECONDS,
  buildLoginRequest,
  isLocalDevPatientLogin,
  LOCAL_DEV_PATIENT_UID,
  mintLocalDevPatientToken,
  normalizeUid,
} from '@ihs/auth-client';
import { APP_ROLE_POLICY, isIhsRole, type IhsRole } from '@ihs/types';
import { getApiBaseUrl, getJwtSecret, isLocalDevelopmentMode } from '@/lib/auth-env';

function buildLocalPatientResponse(token: string): NextResponse {
  const response = NextResponse.json({
    success: true,
    operator: {
      uid: LOCAL_DEV_PATIENT_UID,
      name: 'Lakshmi R.',
      role: 'PATIENT',
    },
    message: 'Local patient session issued via __ihs_at cookie.',
    session: {
      role: 'PATIENT',
      aal: 'AAL1',
      source: 'local_dev_fallback',
      cookie: AUTH_COOKIE_NAME,
    },
  });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_TTL_SECONDS,
  });

  return response;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const uid =
    typeof (body as { ihs_uid?: unknown })?.ihs_uid === 'string'
      ? (body as { ihs_uid: string }).ihs_uid
      : '';
  const pin =
    typeof (body as { pin?: unknown })?.pin === 'string' ? (body as { pin: string }).pin : '';
  const forceLocalFallback = (body as { local_fallback?: unknown })?.local_fallback === true;

  try {
    buildLoginRequest(uid, pin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid credentials payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const normalizedUid = normalizeUid(uid);
  const canUseDevFallback = isLocalDevPatientLogin(normalizedUid, pin);
  const localMode = isLocalDevelopmentMode();

  if (canUseDevFallback && (forceLocalFallback || localMode)) {
    const token = await mintLocalDevPatientToken(getJwtSecret());
    return buildLocalPatientResponse(token);
  }

  const engine = getApiBaseUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${engine}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ihs_uid: normalizedUid, pin }),
    });
  } catch {
    if (canUseDevFallback) {
      const token = await mintLocalDevPatientToken(getJwtSecret());
      return buildLocalPatientResponse(token);
    }
    return NextResponse.json(
      {
        error: 'Cloud Engine unreachable. Use IHS-8802 / 123456 for local patient login.',
      },
      { status: 502 },
    );
  }

  let data: {
    error?: string;
    token?: string;
    success?: boolean;
    operator?: { uid: string; name: string; role: string };
    message?: string;
  };

  try {
    data = (await upstream.json()) as typeof data;
  } catch {
    if (canUseDevFallback) {
      const token = await mintLocalDevPatientToken(getJwtSecret());
      return buildLocalPatientResponse(token);
    }
    return NextResponse.json(
      { error: 'Cloud Engine returned a non-JSON auth response.' },
      { status: 502 },
    );
  }

  if (!upstream.ok || !data.success) {
    if (canUseDevFallback) {
      const token = await mintLocalDevPatientToken(getJwtSecret());
      return buildLocalPatientResponse(token);
    }
    return NextResponse.json(
      { error: data.error || 'Authentication failed' },
      { status: upstream.status || 401 },
    );
  }

  const role = data.operator?.role;
  const allowed = APP_ROLE_POLICY.patientPortal as readonly IhsRole[];
  if (!isIhsRole(role) || !allowed.includes(role)) {
    // Demo Cloud Engine has no PATIENT operator — fall back for IHS-8802.
    if (canUseDevFallback) {
      const token = await mintLocalDevPatientToken(getJwtSecret());
      return buildLocalPatientResponse(token);
    }
    return NextResponse.json(
      { error: 'Authenticated role is not permitted on Patient Portal.' },
      { status: 403 },
    );
  }

  const sessionToken = data.token || (await mintLocalDevPatientToken(getJwtSecret()));
  const response = NextResponse.json({
    success: true,
    operator: data.operator,
    message: data.message,
  });

  response.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_TTL_SECONDS,
  });

  return response;
}
