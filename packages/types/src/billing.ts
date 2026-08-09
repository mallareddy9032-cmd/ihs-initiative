/**
 * IHS Commercial Billing catalog — GST-aware INR plans (Razorpay).
 */

export const PLAN_TIERS = [
  'PATIENT_ESSENTIAL',
  'PATIENT_SHIELD',
  'CLINICAL_PRO',
  'ENTERPRISE_OPS',
] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

export const SUBSCRIPTION_STATUSES = [
  'INACTIVE',
  'ACTIVE',
  'PAST_DUE',
  'CANCELLED',
  'HALTED',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type BillingInterval = 'monthly' | 'annual';

export type PlanDefinition = {
  id: PlanTier;
  name: string;
  tagline: string;
  monthlyInr: number | null;
  annualInr: number | null;
  seatLabel: string;
  vaultGb: number;
  familySeats: number;
  doctorLicenses: number;
  fleetSeats: number;
  erxMonthlyQuota: number;
  slaSeconds: number | null;
  highlights: string[];
  cta: string;
  featured?: boolean;
  customQuote?: boolean;
};

/** Display prices are GST-inclusive list prices; checkout still shows 18% GST breakdown. */
export const IHS_PLAN_CATALOG: readonly PlanDefinition[] = [
  {
    id: 'PATIENT_ESSENTIAL',
    name: 'Patient Essential',
    tagline: 'Individual Vault + Standard Tele-Triage',
    monthlyInr: 199,
    annualInr: 1910,
    seatLabel: '1 patient',
    vaultGb: 5,
    familySeats: 1,
    doctorLicenses: 0,
    fleetSeats: 0,
    erxMonthlyQuota: 0,
    slaSeconds: 900,
    highlights: ['Encrypted Health Vault (5 GB)', 'Standard Tele-Triage', 'GST invoices'],
    cta: 'Start Essential',
  },
  {
    id: 'PATIENT_SHIELD',
    name: 'Patient Shield',
    tagline: 'Up to 6 Family Members + Priority P1 Dispatch + 50GB Vault',
    monthlyInr: 499,
    annualInr: 4790,
    seatLabel: 'Up to 6 family',
    vaultGb: 50,
    familySeats: 6,
    doctorLicenses: 0,
    fleetSeats: 0,
    erxMonthlyQuota: 0,
    slaSeconds: 300,
    highlights: ['50 GB Family Vault', 'Priority P1 Dispatch', '6 family seats'],
    cta: 'Upgrade to Shield',
    featured: true,
  },
  {
    id: 'CLINICAL_PRO',
    name: 'Clinical Pro',
    tagline: 'Full EHR SOAP Charting + e-Rx Engine + Patient Queue',
    monthlyInr: 1499,
    annualInr: 14390,
    seatLabel: 'Per doctor',
    vaultGb: 100,
    familySeats: 0,
    doctorLicenses: 1,
    fleetSeats: 0,
    erxMonthlyQuota: 500,
    slaSeconds: null,
    highlights: ['SOAP Charting', 'e-Rx Engine (500/mo)', 'Consultation Queue'],
    cta: 'Activate Clinical Pro',
  },
  {
    id: 'ENTERPRISE_OPS',
    name: 'Enterprise Ops',
    tagline: 'Full GIS Dispatch HUD + Sub-30s SLA + Fleet ERP',
    monthlyInr: null,
    annualInr: null,
    seatLabel: 'Tenant license',
    vaultGb: 1000,
    familySeats: 0,
    doctorLicenses: 25,
    fleetSeats: 40,
    erxMonthlyQuota: 5000,
    slaSeconds: 30,
    highlights: ['GIS Dispatch HUD', 'Sub-30s SLA', 'Fleet ERP seats'],
    cta: 'Request Quote',
    customQuote: true,
  },
] as const;

export const GST_RATE = 0.18;
export const HSN_SAC_CODE = '998313';
export const DEFAULT_GSTIN = '37AAAAA0000A1Z5';

/** Annual savings badge vs 12× monthly. */
export const ANNUAL_DISCOUNT_PERCENT = 20;

export function priceForInterval(plan: PlanDefinition, interval: BillingInterval): number | null {
  return interval === 'annual' ? plan.annualInr : plan.monthlyInr;
}

export function gstBreakdown(inclusiveInr: number): {
  baseInr: number;
  taxInr: number;
  totalInr: number;
} {
  const totalInr = Math.round(inclusiveInr);
  const baseInr = Math.round(totalInr / (1 + GST_RATE));
  const taxInr = totalInr - baseInr;
  return { baseInr, taxInr, totalInr };
}

export function razorpayPlanIdFor(plan: PlanTier, interval: BillingInterval): string {
  return `plan_ihs_${plan.toLowerCase()}_${interval}`;
}
