import {
  GST_RATE,
  HSN_SAC_CODE,
  type BillingInterval,
  type PlanTier,
  gstBreakdown,
  priceForInterval,
  razorpayPlanIdFor,
  IHS_PLAN_CATALOG,
} from '@ihs/types';

export type RazorpayCheckoutSession = {
  keyId: string;
  subscriptionId: string;
  planId: string;
  planTier: PlanTier;
  interval: BillingInterval;
  amountPaise: number;
  currency: 'INR';
  name: string;
  description: string;
  notes: Record<string, string>;
  /** Local pilot mock when Razorpay secrets are unset. */
  mock: boolean;
  gst: { baseInr: number; taxInr: number; totalInr: number; rate: number; hsnSac: string };
};

function readEnv(name: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return (proc?.env?.[name] || '').trim();
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getRazorpayConfig(): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  configured: boolean;
} {
  const keyId = readEnv('NEXT_PUBLIC_RAZORPAY_KEY_ID');
  const keySecret = readEnv('RAZORPAY_KEY_SECRET');
  const webhookSecret = readEnv('RAZORPAY_WEBHOOK_SECRET');
  return {
    keyId,
    keySecret,
    webhookSecret,
    configured: Boolean(keyId && keySecret),
  };
}

/**
 * Builds a Razorpay subscription checkout payload.
 * When secrets are missing, returns a deterministic local mock subscription id
 * so portals can complete the pilot checkout UX offline.
 */
export function buildCheckoutSession(input: {
  planTier: PlanTier;
  interval: BillingInterval;
  userId: string;
  tenantId: string;
  customerName?: string;
  customerEmail?: string;
}): RazorpayCheckoutSession {
  const plan = IHS_PLAN_CATALOG.find((p) => p.id === input.planTier);
  if (!plan || plan.customQuote || plan.monthlyInr == null) {
    throw new Error('Selected plan requires a custom Enterprise Ops quote.');
  }

  const listInr = priceForInterval(plan, input.interval);
  if (listInr == null) {
    throw new Error('Price unavailable for selected interval.');
  }

  const gst = gstBreakdown(listInr);
  const amountPaise = gst.totalInr * 100;
  const planId = razorpayPlanIdFor(input.planTier, input.interval);
  const cfg = getRazorpayConfig();
  const mock = !cfg.configured;
  const subscriptionId = mock
    ? `sub_mock_${input.planTier.toLowerCase()}_${Date.now()}`
    : `sub_pending_${input.userId}_${Date.now()}`;

  return {
    keyId: cfg.keyId || 'rzp_test_ihs_local',
    subscriptionId,
    planId,
    planTier: input.planTier,
    interval: input.interval,
    amountPaise,
    currency: 'INR',
    name: 'IHS Initiative',
    description: `${plan.name} · ${input.interval}`,
    notes: {
      userId: input.userId,
      tenantId: input.tenantId,
      planTier: input.planTier,
      interval: input.interval,
    },
    mock,
    gst: { ...gst, rate: GST_RATE, hsnSac: HSN_SAC_CODE },
  };
}

/**
 * Validates Razorpay webhook signatures (HMAC-SHA256 hex digest).
 */
export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string = getRazorpayConfig().webhookSecret,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;

  const enc = new TextEncoder();
  const key = await subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await subtle.sign('HMAC', key, enc.encode(rawBody));
  return timingSafeEqualHex(toHex(mac), signatureHeader.trim().toLowerCase());
}

export type RazorpayWebhookEvent =
  | 'subscription.authenticated'
  | 'subscription.charged'
  | 'subscription.halted'
  | 'payment.failed'
  | string;

export function mapWebhookToSubscriptionStatus(
  event: RazorpayWebhookEvent,
): 'ACTIVE' | 'HALTED' | 'PAST_DUE' | null {
  switch (event) {
    case 'subscription.authenticated':
    case 'subscription.charged':
      return 'ACTIVE';
    case 'subscription.halted':
      return 'HALTED';
    case 'payment.failed':
      return 'PAST_DUE';
    default:
      return null;
  }
}
