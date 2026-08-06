// ============================================================================
// FILE: middleware.ts
// CONTEXT: Next.js Edge Middleware for Route Protection
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'FATAL_UNCONFIGURED_SECRET';

async function isValidAuthToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const role = payload.role;
    if (role !== 'DISPATCHER' && role !== 'PHYSICIAN' && role !== 'SYSTEM_ADMIN') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // 1. Extract the JWT from secure HTTP-only cookies
  const token = request.cookies.get('ihs_auth_token')?.value;
  const { pathname } = request.nextUrl;

  // 2. Define Protected Route Paths
  const isDispatcherRoute = pathname.startsWith('/dispatcher');
  const isPhysicianRoute = pathname.startsWith('/physician');

  const redirectToLogin = () => {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  };

  // 3. Absolute Rejection Logic — missing cookie
  if ((isDispatcherRoute || isPhysicianRoute) && !token) {
    return redirectToLogin();
  }

  // 4. Cryptographic JWT validation (Edge-compatible via jose)
  if (token) {
    const valid = await isValidAuthToken(token);
    if (!valid) {
      const response = redirectToLogin();
      response.cookies.set('ihs_auth_token', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/',
      });
      return response;
    }
  }

  return NextResponse.next();
}

// 5. Optimize execution by limiting middleware to specific paths
export const config = {
  matcher: ['/dispatcher/:path*', '/physician/:path*'],
};
