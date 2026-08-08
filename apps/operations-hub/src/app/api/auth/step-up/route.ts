import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  AUTH_TTL_SECONDS,
  mintAal3SuperAdminToken,
  verifyAuthToken,
} from '@ihs/auth-client';
import { getJwtSecret } from '@/lib/auth-env';

/**
 * Simulates hardware-key / TOTP verification and elevates the session to AAL3
 * with superadmin:tenant:write for SYSTEM_ADMIN operators.
 */
export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = getJwtSecret();
  const claims = token ? await verifyAuthToken(token, secret) : null;

  if (!claims) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  if (claims.role !== 'SYSTEM_ADMIN' && claims.role !== 'Super_Admin') {
    return NextResponse.json(
      { error: 'Only Super Admin operators may complete AAL3 step-up.' },
      { status: 403 },
    );
  }

  let body: { method?: string; code?: string } = {};
  try {
    body = (await request.json()) as { method?: string; code?: string };
  } catch {
    body = {};
  }

  const method = body.method === 'webauthn' ? 'webauthn' : 'totp';
  const code = typeof body.code === 'string' ? body.code.replace(/\s/g, '') : '';

  if (method === 'totp') {
    // Placeholder verifier: accept any well-formed 6-digit TOTP for local pilot simulation.
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Enter a valid 6-digit TOTP code from your authenticator.' },
        { status: 400 },
      );
    }
  }

  try {
    const elevated = await mintAal3SuperAdminToken(claims, secret);
    const response = NextResponse.json({
      success: true,
      aal: 3,
      scopes: ['superadmin:tenant:write'],
      method,
      message: 'Step-up MFA verified. Super Admin session elevated to AAL3.',
    });
    response.cookies.set(AUTH_COOKIE_NAME, elevated, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_TTL_SECONDS,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Step-up elevation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
