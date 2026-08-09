import { NextRequest, NextResponse } from 'next/server';
import { IHS_PLAN_CATALOG } from '@ihs/types';
import { db } from '@ihs/db';

/**
 * GET /api/billing/status?userId=DOC-101
 */
export async function GET(request: NextRequest) {
  const userId =
    request.nextUrl.searchParams.get('userId')?.trim().toUpperCase() || 'DOC-101';

  const sub = await db.subscription.findByUserId(userId);
  const plan = IHS_PLAN_CATALOG.find((p) => p.id === (sub?.planTier ?? 'CLINICAL_PRO'));
  const charts = await db.clinicalChart.findMany({ where: { clinicianUid: userId } });
  const erxUsed = charts.reduce((sum, c) => sum + c.prescriptions.length, 0);

  return NextResponse.json({
    mode: db.mode,
    userId,
    subscription: sub
      ? {
          id: sub.id,
          planTier: sub.planTier,
          status: sub.status,
          doctorLicenses: plan?.doctorLicenses ?? 1,
          erxMonthlyQuota: plan?.erxMonthlyQuota ?? 500,
          currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
    meters: {
      erxUsed,
      erxQuota: plan?.erxMonthlyQuota ?? 500,
      aiSoapEnabled: sub?.status === 'ACTIVE',
    },
    invoices: (sub?.invoices ?? []).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      taxAmount: inv.taxAmount,
      currency: inv.currency,
      status: inv.status,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt.toISOString(),
    })),
  });
}
