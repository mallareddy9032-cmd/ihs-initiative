import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  evaluateRouteGuard,
  roleAllowed,
  SUPER_ADMIN_ROUTE_REQUIREMENT,
  verifyAuthToken,
} from '@ihs/auth-client';
import { APP_ROLE_POLICY } from '@ihs/types';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'FATAL_UNCONFIGURED_SECRET';

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico'
  );
}

function isStepUpPath(pathname: string): boolean {
  return pathname === '/auth/step-up' || pathname.startsWith('/auth/step-up/');
}

function isSuperPath(pathname: string): boolean {
  return pathname.startsWith('/admin/super') || pathname.startsWith('/api/super');
}

function clearSessionAndRedirect(request: NextRequest, target: string): NextResponse {
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}

function jsonDenied(status: number, error: string, reason: string): NextResponse {
  return NextResponse.json({ error, reason }, { status });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Step-up MFA page: require an authenticated ops session, but allow AAL < 3.
  if (isStepUpPath(pathname)) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    const claims = await verifyAuthToken(token, JWT_SECRET);
    if (!claims || !roleAllowed(claims.role, APP_ROLE_POLICY.operationsHub)) {
      return clearSessionAndRedirect(request, '/login');
    }
    return NextResponse.next();
  }

  // Phase 3 Super Admin control plane — SYSTEM_ADMIN + scope + AAL3.
  if (isSuperPath(pathname)) {
    const decision = await evaluateRouteGuard(token, JWT_SECRET, SUPER_ADMIN_ROUTE_REQUIREMENT);
    const wantsJson = pathname.startsWith('/api/super');

    if (decision.ok) {
      return NextResponse.next();
    }

    if (decision.reason === 'UNAUTHENTICATED') {
      if (wantsJson) {
        return jsonDenied(401, 'Authentication required for Super Admin API.', decision.reason);
      }
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (decision.reason === 'STEP_UP_REQUIRED') {
      if (wantsJson) {
        return jsonDenied(
          403,
          'AAL3 step-up MFA required for superadmin:tenant:write operations.',
          decision.reason,
        );
      }
      const stepUp = new URL('/auth/step-up', request.url);
      stepUp.searchParams.set('callbackUrl', pathname);
      stepUp.searchParams.set('reason', 'aal3');
      return NextResponse.redirect(stepUp);
    }

    if (decision.reason === 'MISSING_SCOPE') {
      if (wantsJson) {
        return jsonDenied(
          403,
          'Missing required scope superadmin:tenant:write.',
          decision.reason,
        );
      }
      const stepUp = new URL('/auth/step-up', request.url);
      stepUp.searchParams.set('callbackUrl', pathname);
      stepUp.searchParams.set('reason', 'scope');
      return NextResponse.redirect(stepUp);
    }

    // FORBIDDEN_ROLE
    if (wantsJson) {
      return jsonDenied(403, 'SYSTEM_ADMIN role required for Super Admin routes.', decision.reason);
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Baseline Operations Hub gate (dispatcher + system admin).
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const claims = await verifyAuthToken(token, JWT_SECRET);
  if (!claims || !roleAllowed(claims.role, APP_ROLE_POLICY.operationsHub)) {
    return clearSessionAndRedirect(request, '/login');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
