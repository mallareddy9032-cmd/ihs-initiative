import {
  SUPER_ADMIN_ROLES,
  SUPERADMIN_TENANT_WRITE_SCOPE,
  type AuthenticatorAssuranceLevel,
  type IhsAuthClaims,
  type IhsRole,
} from '@ihs/types';
import { verifyAuthToken } from './jwt';

export type RouteGuardRequirement = {
  allowedRoles?: readonly IhsRole[];
  requiredScopes?: readonly string[];
  /** Minimum AAL required (inclusive). Super Admin write paths use 3. */
  requiredAal?: AuthenticatorAssuranceLevel;
};

export type RouteGuardDenialReason =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN_ROLE'
  | 'MISSING_SCOPE'
  | 'STEP_UP_REQUIRED';

export type RouteGuardResult =
  | { ok: true; claims: IhsAuthClaims }
  | {
      ok: false;
      reason: RouteGuardDenialReason;
      claims: IhsAuthClaims | null;
    };

export const SUPER_ADMIN_ROUTE_REQUIREMENT: RouteGuardRequirement = {
  allowedRoles: SUPER_ADMIN_ROLES,
  requiredScopes: [SUPERADMIN_TENANT_WRITE_SCOPE],
  requiredAal: 3,
};

function hasAllScopes(granted: readonly string[], required: readonly string[]): boolean {
  if (required.length === 0) return true;
  const set = new Set(granted);
  return required.every((scope) => set.has(scope));
}

/**
 * Evaluates RBAC + scope + MFA assurance for a protected route.
 * Callers map `STEP_UP_REQUIRED` → `/auth/step-up` and other denials → login/403.
 */
export async function evaluateRouteGuard(
  token: string | undefined,
  secret: string,
  requirement: RouteGuardRequirement,
): Promise<RouteGuardResult> {
  if (!token) {
    return { ok: false, reason: 'UNAUTHENTICATED', claims: null };
  }

  const claims = await verifyAuthToken(token, secret);
  if (!claims) {
    return { ok: false, reason: 'UNAUTHENTICATED', claims: null };
  }

  if (
    requirement.allowedRoles &&
    requirement.allowedRoles.length > 0 &&
    !requirement.allowedRoles.includes(claims.role)
  ) {
    return { ok: false, reason: 'FORBIDDEN_ROLE', claims };
  }

  if (
    requirement.requiredScopes &&
    requirement.requiredScopes.length > 0 &&
    !hasAllScopes(claims.scopes, requirement.requiredScopes)
  ) {
    return { ok: false, reason: 'MISSING_SCOPE', claims };
  }

  if (
    typeof requirement.requiredAal === 'number' &&
    claims.aal < requirement.requiredAal
  ) {
    return { ok: false, reason: 'STEP_UP_REQUIRED', claims };
  }

  return { ok: true, claims };
}
