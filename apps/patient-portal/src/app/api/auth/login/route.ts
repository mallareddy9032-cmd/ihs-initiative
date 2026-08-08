import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, AUTH_TTL_SECONDS, buildLoginRequest } from '@ihs/auth-client';
import { APP_ROLE_POLICY, isIhsRole, type IhsRole } from '@ihs/types';
import { getApiBaseUrl } from '@/lib/auth-env';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const uid = typeof (body as { ihs_uid?: unknown })?.ihs_uid === 'string'
    ? (body as { ihs_uid: string }).ihs_uid
    : '';
  const pin = typeof (body as { pin?: unknown })?.pin === 'string'
    ? (body as { pin: string }).pin
    : '';

  try {
    buildLoginRequest(uid, pin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid credentials payload.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const engine = getApiBaseUrl();
  let upstream: Response;
  try {
    upstream = await fetch(`${engine}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ihs_uid: uid.trim().toUpperCase(), pin }),
    });
  } catch {
    return NextResponse.json(
      { error: 'Cloud Engine unreachable. Confirm API base URL.' },
      { status: 502 },
    );
  }

  const data = (await upstream.json()) as {
    error?: string;
    token?: string;
    success?: boolean;
    operator?: { uid: string; name: string; role: string };
    message?: string;
  };

  if (!upstream.ok) {
    return NextResponse.json(
      { error: data.error || 'Authentication failed' },
      { status: upstream.status },
    );
  }

  const role = data.operator?.role;
  const allowed = APP_ROLE_POLICY.patientPortal as readonly IhsRole[];
  if (!isIhsRole(role) || !allowed.includes(role)) {
    return NextResponse.json(
      { error: 'Authenticated role is not permitted on Patient Portal.' },
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
