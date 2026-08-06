import { NextResponse } from 'next/server';

const ENGINE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export async function POST() {
  try {
    await fetch(`${ENGINE}/v1/auth/logout`, { method: 'POST' });
  } catch {
    // ignore upstream logout failures in local demo
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('ihs_auth_token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
