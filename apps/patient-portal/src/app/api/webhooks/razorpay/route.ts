import { NextRequest, NextResponse } from 'next/server';
import {
  getRazorpayConfig,
  mapWebhookToSubscriptionStatus,
  verifyRazorpayWebhookSignature,
} from '@ihs/auth-client';
import { gstBreakdown } from '@ihs/types';
import { db } from '@ihs/db';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/razorpay
 * Validates HMAC-SHA256 signatures and syncs Subscription + Invoice rows.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  const { webhookSecret, configured } = getRazorpayConfig();

  // Local pilot: allow unsigned webhooks only when secrets are unset.
  if (configured || webhookSecret) {
    const valid = await verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid Razorpay webhook signature.' }, { status: 401 });
    }
  }

  let payload: {
    event?: string;
    payload?: {
      subscription?: {
        entity?: {
          id?: string;
          notes?: { userId?: string; tenantId?: string; planTier?: string };
          current_end?: number;
        };
      };
      payment?: {
        entity?: {
          amount?: number;
          id?: string;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON webhook body.' }, { status: 400 });
  }

  const event = payload.event || '';
  const status = mapWebhookToSubscriptionStatus(event);
  const entity = payload.payload?.subscription?.entity;
  const razorpaySubId = entity?.id;
  const notes = entity?.notes || {};

  if (!status) {
    return NextResponse.json({ success: true, ignored: true, event });
  }

  let sub =
    (razorpaySubId && (await db.subscription.findByRazorpaySubId(razorpaySubId))) ||
    (notes.userId ? await db.subscription.findByUserId(notes.userId.toUpperCase()) : null);

  if (!sub && notes.userId && notes.planTier) {
    sub = await db.subscription.upsertForUser({
      userId: notes.userId.toUpperCase(),
      tenantId: notes.tenantId || 'tenant-antp',
      planTier: notes.planTier as 'PATIENT_ESSENTIAL',
      status,
      razorpaySubId: razorpaySubId ?? null,
      currentPeriodEnd: entity?.current_end
        ? new Date(entity.current_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  } else if (sub) {
    sub = await db.subscription.updateStatus({
      id: sub.id,
      razorpaySubId: razorpaySubId ?? undefined,
      status,
      currentPeriodEnd: entity?.current_end ? new Date(entity.current_end * 1000) : undefined,
    });
  }

  if (sub && (event === 'subscription.charged' || event === 'subscription.authenticated')) {
    const amountPaise = payload.payload?.payment?.entity?.amount ?? 19900;
    const totalInr = Math.round(amountPaise / 100);
    const gst = gstBreakdown(totalInr);
    await db.invoice.create({
      data: {
        subscriptionId: sub.id,
        amount: gst.baseInr,
        taxAmount: gst.taxInr,
        pdfUrl: `/api/billing/invoices/${payload.payload?.payment?.entity?.id || 'latest'}.pdf`,
        status: 'PAID',
      },
    });
  } else if (sub && event === 'payment.failed') {
    await db.invoice.create({
      data: {
        subscriptionId: sub.id,
        amount: 0,
        taxAmount: 0,
        status: 'FAILED',
      },
    });
  }

  return NextResponse.json({
    success: true,
    event,
    subscriptionId: sub?.id ?? null,
    status: sub?.status ?? null,
  });
}
