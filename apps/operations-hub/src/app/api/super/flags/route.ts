import { NextResponse } from 'next/server';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/super-admin-data';

export async function GET() {
  return NextResponse.json({
    surface: 'operations-hub',
    scope: 'superadmin:tenant:write',
    aal: 3,
    flags: DEFAULT_FEATURE_FLAGS,
  });
}
