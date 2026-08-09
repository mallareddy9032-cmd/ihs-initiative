import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_TTL_SECONDS,
  buildLoginRequest,
  isLocalDevPhysicianLogin,
  mintLocalDevPhysicianToken,
  normalizeUid,
  resolveLocalDevPhysician,
} from '@ihs/auth-client';
import { APP_ROLE_POLICY, isIhsRole, type IhsRole } from '@ihs/types';
import { getApiBaseUrl, getJwtSecret, isLocalDevelopmentMode } from '@/lib/auth-env';

function buildLocalPhysicianResponse(uid: string, token: string, name: string): NextResponse {
  const response = NextResponse.json({
    success: true,
    operator: {
      uid,
      name,
      role: 'PHYSICIAN',
    },
    message: 'Local clinical session issued via __ihs_at cookie.',
    session: {
      role: 'PHYSICIAN',
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

async function issueLocalPhysicianSession(uid: string): Promise<NextResponse> {
  const account = resolveLocalDevPhysician(uid);
  if (!account) {
    return NextResponse.json({ error: 'Unknown local physician account.' }, { status: 401 });
  }
  const token = await mintLocalDevPhysicianToken(account.uid, getJwtSecret());
  return buildLocalPhysicianResponse(account.uid, token, account.name);
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
  const canUseDevFallback = isLocalDevPhysicianLogin(normalizedUid, pin);
  const localMode = isLocalDevelopmentMode();

  if (canUseDevFallback && (forceLocalFallback || localMode)) {
    return issueLocalPhysicianSession(normalizedUid);
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
      return issueLocalPhysicianSession(normalizedUid);
    }
    return NextResponse.json(
      {
        error:
          'Cloud Engine unreachable. Use DOC-101 / 123456 (or PHY-1001 / 654321) for local clinical login.',
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
      return issueLocalPhysicianSession(normalizedUid);
    }
    return NextResponse.json(
      { error: 'Cloud Engine returned a non-JSON auth response.' },
      { status: 502 },
    );
  }

  if (!upstream.ok || !data.success) {
    if (canUseDevFallback) {
      return issueLocalPhysicianSession(normalizedUid);
    }
    return NextResponse.json(
      { error: data.error || 'Authentication failed' },
      { status: upstream.status || 401 },
    );
  }

  const role = data.operator?.role;
  const allowed = APP_ROLE_POLICY.clinicalWorkspace as readonly IhsRole[];
  if (!isIhsRole(role) || !allowed.includes(role)) {
    return NextResponse.json(
      { error: 'Authenticated role is not permitted on Clinical Workspace.' },
      { status: 403 },
    );
  }

  // Prefer a locally minted PHYSICIAN token so Edge middleware can verify with the
  // portal JWT secret even when Cloud Engine uses a mismatched signing key.
  const sessionToken = await mintLocalDevPhysicianToken(
    data.operator?.uid || normalizedUid,
    getJwtSecret(),
  );

  const response = NextResponse.json({
    success: true,
    operator: data.operator,
    message: data.message,
    session: {
      role: 'PHYSICIAN',
      aal: 'AAL1',
      source: data.token ? 'cloud_engine' : 'local_dev_fallback',
    },
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
