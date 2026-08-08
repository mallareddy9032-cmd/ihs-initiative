import { NextResponse } from 'next/server';
import { AUDIT_LEDGER } from '@/lib/super-admin-data';

export async function GET() {
  return NextResponse.json({
    surface: 'operations-hub',
    ledger: AUDIT_LEDGER,
    chain: 'HMAC-SHA256',
  });
}
