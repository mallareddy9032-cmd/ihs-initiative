import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, roleAllowed, verifyAuthToken } from '@ihs/auth-client';
import { APP_ROLE_POLICY } from '@ihs/types';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'FATAL_UNCONFIGURED_SECRET';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const claims = await verifyAuthToken(token, JWT_SECRET);
  if (!claims || !roleAllowed(claims.role, APP_ROLE_POLICY.clinicalWorkspace)) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set(AUTH_COOKIE_NAME, '', {
      httpOnly: true,
      expires: new Date(0),
      path: '/',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
