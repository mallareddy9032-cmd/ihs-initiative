import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_TTL_SECONDS,
  buildLoginRequest,
  isLocalDevSuperAdminLogin,
  LOCAL_DEV_SUPER_ADMIN_SCOPES,
  LOCAL_DEV_SUPER_ADMIN_UID,
  mintLocalDevSuperAdminToken,
  normalizeUid,
} from '@ihs/auth-client';
import { APP_ROLE_POLICY, isIhsRole, type IhsRole } from '@ihs/types';
import { getApiBaseUrl, getJwtSecret, isLocalDevelopmentMode } from '@/lib/auth-env';

async function issueLocalDevSuperAdminSession(): Promise<NextResponse> {
  const token = await mintLocalDevSuperAdminToken(getJwtSecret());
  const response = NextResponse.json({
    success: true,
    operator: {
      uid: LOCAL_DEV_SUPER_ADMIN_UID,
      name: 'Local Super Admin',
      role: 'Super_Admin',
    },
    message:
      'Local development session issued via __ihs_at cookie. AAL2 — complete step-up for Super Admin mutations.',
    session: {
      role: 'Super_Admin',
      scopes: [...LOCAL_DEV_SUPER_ADMIN_SCOPES],
      aal: 'AAL2',
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
    typeof (body as { pin?: unknown })?.pin === 'string'
      ? (body as { pin: string }).pin
      : '';
  const forceLocalFallback = (body as { local_fallback?: unknown })?.local_fallback === true;

  try {
    buildLoginRequest(uid, pin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid credentials payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const normalizedUid = normalizeUid(uid);
  const localMode = isLocalDevelopmentMode();
  const canUseDevFallback = isLocalDevSuperAdminLogin(normalizedUid, pin);

  // Client-forced or local-mode SUPER-001 path: issue __ihs_at mock immediately.
  if (canUseDevFallback && (forceLocalFallback || localMode)) {
    return issueLocalDevSuperAdminSession();
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
      return issueLocalDevSuperAdminSession();
    }
    return NextResponse.json(
      { error: 'Cloud Engine unreachable. Confirm API base URL.' },
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
      return issueLocalDevSuperAdminSession();
    }
    return NextResponse.json(
      { error: 'Cloud Engine returned a non-JSON auth response.' },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    if (canUseDevFallback) {
      return issueLocalDevSuperAdminSession();
    }
    return NextResponse.json(
      { error: data.error || 'Authentication failed' },
      { status: upstream.status },
    );
  }

  const role = data.operator?.role;
  const allowed = APP_ROLE_POLICY.operationsHub as readonly IhsRole[];
  if (!isIhsRole(role) || !allowed.includes(role)) {
    if (canUseDevFallback) {
      return issueLocalDevSuperAdminSession();
    }
    return NextResponse.json(
      { error: 'Authenticated role is not permitted on Operations Hub.' },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    success: true,
    operator: data.operator,
    message: data.message,
  });

  if (data.token) {
    response.cookies.set(AUTH_COOKIE_NAME, data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_TTL_SECONDS,
    });
  }

  return response;
}
