import { NextRequest, NextResponse } from 'next/server';
import { buildCheckoutSession } from '@ihs/auth-client';
import { PLAN_TIERS, type BillingInterval, type PlanTier } from '@ihs/types';
import { db } from '@ihs/db';

function isPlanTier(value: string): value is PlanTier {
  return (PLAN_TIERS as readonly string[]).includes(value);
}

/**
 * POST /api/billing/checkout
 * Creates a Razorpay subscription checkout session (or local mock when keys unset).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const planTierRaw =
    typeof (body as { planTier?: unknown }).planTier === 'string'
      ? (body as { planTier: string }).planTier.trim().toUpperCase()
      : '';
  const intervalRaw =
    typeof (body as { interval?: unknown }).interval === 'string'
      ? (body as { interval: string }).interval.trim().toLowerCase()
      : 'monthly';
  const userId =
    typeof (body as { userId?: unknown }).userId === 'string'
      ? (body as { userId: string }).userId.trim().toUpperCase()
      : 'IHS-8802';
  const tenantId =
    typeof (body as { tenantId?: unknown }).tenantId === 'string'
      ? (body as { tenantId: string }).tenantId.trim()
      : 'tenant-antp';

  if (!isPlanTier(planTierRaw)) {
    return NextResponse.json({ error: 'Invalid planTier.' }, { status: 400 });
  }
  if (planTierRaw === 'ENTERPRISE_OPS') {
    return NextResponse.json(
      { error: 'Enterprise Ops requires a custom quote. Contact contact@IHSGlobalservices.com.' },
      { status: 400 },
    );
  }

  const interval: BillingInterval = intervalRaw === 'annual' ? 'annual' : 'monthly';

  try {
    const session = buildCheckoutSession({
      planTier: planTierRaw,
      interval,
      userId,
      tenantId,
    });

    // Persist pending/active mock subscription for local pilot continuity.
    await db.subscription.upsertForUser({
      userId,
      tenantId,
      planTier: planTierRaw,
      status: session.mock ? 'ACTIVE' : 'INACTIVE',
      razorpaySubId: session.subscriptionId,
      razorpayPlanId: session.planId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(
        Date.now() + (interval === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000,
      ),
    });

    if (session.mock) {
      const sub = await db.subscription.findByUserId(userId);
      if (sub) {
        await db.invoice.create({
          data: {
            subscriptionId: sub.id,
            amount: session.gst.baseInr,
            taxAmount: session.gst.taxInr,
            pdfUrl: `/api/billing/invoices/latest.pdf`,
            status: 'PAID',
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      checkout: session,
      methods: ['upi', 'card', 'netbanking'],
      message: session.mock
        ? 'Local mock checkout issued (Razorpay keys unset). Subscription activated for pilot.'
        : 'Razorpay checkout session ready.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout session failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
