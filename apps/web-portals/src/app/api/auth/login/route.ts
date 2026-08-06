import { NextRequest, NextResponse } from 'next/server';

const ENGINE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const upstream = await fetch(`${ENGINE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

  const response = NextResponse.json({
    success: true,
    operator: data.operator,
    message: data.message,
  });

  if (data.token) {
    response.cookies.set('ihs_auth_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 12 * 60 * 60,
    });
  }

  return response;
}
