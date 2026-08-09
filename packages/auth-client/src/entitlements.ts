import type { PlanTier, SubscriptionStatus } from '@ihs/types';
import { IHS_PLAN_CATALOG } from '@ihs/types';

export type EntitlementAction = 'vault_upload' | 'issue_erx' | 'priority_dispatch' | 'ai_soap';

export type EntitlementInput = {
  status: SubscriptionStatus | string | null | undefined;
  planTier: PlanTier | string | null | undefined;
  /** Proposed vault payload size in bytes (for vault_upload). */
  uploadBytes?: number;
  /** Existing vault usage bytes. */
  vaultUsedBytes?: number;
};

export type EntitlementResult =
  | { allowed: true; planTier: PlanTier; vaultCapBytes: number }
  | {
      allowed: false;
      code: 'SUBSCRIPTION_INACTIVE' | 'VAULT_QUOTA_EXCEEDED' | 'PLAN_NOT_PERMITTED';
      message: string;
      planTier: PlanTier | null;
      vaultCapBytes: number;
    };

const ACTIVE: ReadonlySet<string> = new Set(['ACTIVE']);

function resolvePlan(planTier: string | null | undefined): PlanTier {
  const match = IHS_PLAN_CATALOG.find((p) => p.id === planTier);
  return match?.id ?? 'PATIENT_ESSENTIAL';
}

function vaultCapBytes(planTier: PlanTier): number {
  const plan = IHS_PLAN_CATALOG.find((p) => p.id === planTier);
  const gb = plan?.vaultGb ?? 5;
  return gb * 1024 * 1024 * 1024;
}

/**
 * Entitlement gate for monetized actions.
 * - vault_upload: blocks when subscription inactive OR total usage would exceed plan vault cap
 *   (Essential = 5GB; Shield = 50GB; Clinical/Enterprise higher).
 * - issue_erx: requires CLINICAL_PRO or ENTERPRISE_OPS with ACTIVE status.
 */
export function evaluateEntitlement(
  action: EntitlementAction,
  input: EntitlementInput,
): EntitlementResult {
  const planTier = resolvePlan(input.planTier);
  const cap = vaultCapBytes(planTier);
  const status = (input.status || 'INACTIVE').toUpperCase();

  if (!ACTIVE.has(status)) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_INACTIVE',
      message: 'An active IHS subscription is required for this action.',
      planTier,
      vaultCapBytes: cap,
    };
  }

  if (action === 'issue_erx') {
    if (planTier !== 'CLINICAL_PRO' && planTier !== 'ENTERPRISE_OPS') {
      return {
        allowed: false,
        code: 'PLAN_NOT_PERMITTED',
        message: 'e-Prescriptions require Clinical Pro or Enterprise Ops.',
        planTier,
        vaultCapBytes: cap,
      };
    }
    return { allowed: true, planTier, vaultCapBytes: cap };
  }

  if (action === 'ai_soap') {
    if (planTier !== 'CLINICAL_PRO' && planTier !== 'ENTERPRISE_OPS') {
      return {
        allowed: false,
        code: 'PLAN_NOT_PERMITTED',
        message: 'AI SOAP Assistant is a Clinical Pro add-on.',
        planTier,
        vaultCapBytes: cap,
      };
    }
    return { allowed: true, planTier, vaultCapBytes: cap };
  }

  if (action === 'priority_dispatch') {
    if (planTier === 'PATIENT_ESSENTIAL') {
      return {
        allowed: false,
        code: 'PLAN_NOT_PERMITTED',
        message: 'Priority P1 dispatch requires Patient Shield or higher.',
        planTier,
        vaultCapBytes: cap,
      };
    }
    return { allowed: true, planTier, vaultCapBytes: cap };
  }

  // vault_upload
  const used = Math.max(0, input.vaultUsedBytes ?? 0);
  const incoming = Math.max(0, input.uploadBytes ?? 0);
  if (used + incoming > cap) {
    return {
      allowed: false,
      code: 'VAULT_QUOTA_EXCEEDED',
      message: `Vault quota exceeded for ${planTier}. Upgrade plan to continue uploads.`,
      planTier,
      vaultCapBytes: cap,
    };
  }

  return { allowed: true, planTier, vaultCapBytes: cap };
}

/** Convenience: uploads larger than 5GB always require Shield+ active entitlement. */
export function requiresShieldForLargeUpload(uploadBytes: number): boolean {
  return uploadBytes > 5 * 1024 * 1024 * 1024;
}
