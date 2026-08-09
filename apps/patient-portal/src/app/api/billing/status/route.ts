import { NextRequest, NextResponse } from 'next/server';
import { IHS_PLAN_CATALOG } from '@ihs/types';
import { db } from '@ihs/db';

/**
 * GET /api/billing/status?userId=IHS-8802
 */
export async function GET(request: NextRequest) {
  const userId =
    request.nextUrl.searchParams.get('userId')?.trim().toUpperCase() || 'IHS-8802';

  const sub = await db.subscription.findByUserId(userId);
  const patient = await db.patient.upsertByUid({ ihsUid: userId });
  const usedBytes = await db.vaultUsageBytes(patient.id);
  const plan = IHS_PLAN_CATALOG.find((p) => p.id === (sub?.planTier ?? 'PATIENT_ESSENTIAL'));
  const capBytes = (plan?.vaultGb ?? 5) * 1024 * 1024 * 1024;

  return NextResponse.json({
    mode: db.mode,
    userId,
    subscription: sub
      ? {
          id: sub.id,
          planTier: sub.planTier,
          status: sub.status,
          razorpaySubId: sub.razorpaySubId,
          currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          familySeats: plan?.familySeats ?? 1,
          vaultGb: plan?.vaultGb ?? 5,
        }
      : null,
    vault: {
      usedBytes,
      capBytes,
      usedGb: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(2)),
      capGb: plan?.vaultGb ?? 5,
    },
    invoices: (sub?.invoices ?? []).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      taxAmount: inv.taxAmount,
      currency: inv.currency,
      hsnSacCode: inv.hsnSacCode,
      gstin: inv.gstin,
      status: inv.status,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt.toISOString(),
    })),
  });
}
