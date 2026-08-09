import { NextRequest, NextResponse } from 'next/server';
import { IHS_PLAN_CATALOG } from '@ihs/types';
import { db } from '@ihs/db';

/**
 * GET /api/billing/status?userId=SUPER-001
 * Tenant license snapshot for Super Admin HUD.
 */
export async function GET(request: NextRequest) {
  const userId =
    request.nextUrl.searchParams.get('userId')?.trim().toUpperCase() || 'SUPER-001';
  const tenantId =
    request.nextUrl.searchParams.get('tenantId')?.trim() || 'tenant-antp-ops';

  const sub =
    (await db.subscription.findByUserId(userId)) ||
    (await db.subscription.findByTenantId(tenantId));
  const plan = IHS_PLAN_CATALOG.find((p) => p.id === (sub?.planTier ?? 'ENTERPRISE_OPS'));

  const renewalDays = sub?.currentPeriodEnd
    ? Math.max(
        0,
        Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : null;

  return NextResponse.json({
    mode: db.mode,
    license: {
      planTier: sub?.planTier ?? 'ENTERPRISE_OPS',
      status: sub?.status ?? 'INACTIVE',
      slaSeconds: plan?.slaSeconds ?? 30,
      fleetSeats: plan?.fleetSeats ?? 40,
      doctorLicenses: plan?.doctorLicenses ?? 25,
      renewalDays,
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      razorpaySubId: sub?.razorpaySubId ?? null,
    },
  });
}
