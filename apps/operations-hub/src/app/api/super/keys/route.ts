import { NextResponse } from 'next/server';
import { CRYPTO_KEYS } from '@/lib/super-admin-data';

export async function GET() {
  return NextResponse.json({
    surface: 'operations-hub',
    keys: CRYPTO_KEYS.map((key) => ({
      ...key,
      // Never expose raw key material on the control plane API.
      material: null,
    })),
  });
}
