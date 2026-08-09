import { NextRequest, NextResponse } from 'next/server';
import { buildCheckoutSession } from '@ihs/auth-client';
import type { BillingInterval } from '@ihs/types';
import { db } from '@ihs/db';

/**
 * POST /api/billing/checkout — Clinical Pro Razorpay session.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const userId =
    typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId.trim().toUpperCase()
      : 'DOC-101';
  const interval: BillingInterval =
    (body as { interval?: string }).interval === 'annual' ? 'annual' : 'monthly';

  try {
    const session = buildCheckoutSession({
      planTier: 'CLINICAL_PRO',
      interval,
      userId,
      tenantId: 'tenant-antp-clinic',
    });

    await db.subscription.upsertForUser({
      userId,
      tenantId: 'tenant-antp-clinic',
      planTier: 'CLINICAL_PRO',
      status: session.mock ? 'ACTIVE' : 'INACTIVE',
      razorpaySubId: session.subscriptionId,
      razorpayPlanId: session.planId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(
        Date.now() + (interval === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000,
      ),
    });

    return NextResponse.json({ success: true, checkout: session, methods: ['upi', 'card', 'netbanking'] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
