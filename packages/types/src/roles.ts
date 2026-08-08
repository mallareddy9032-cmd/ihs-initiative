export const IHS_ROLES = [
  'PATIENT',
  'PHYSICIAN',
  'DISPATCHER',
  'SYSTEM_ADMIN',
  'Super_Admin',
  'FLEET_DRIVER',
  'HOSPITAL_ER',
] as const;

export type IhsRole = (typeof IHS_ROLES)[number];

/** Canonical Super Admin role aliases accepted on privileged control-plane routes. */
export const SUPER_ADMIN_ROLES = ['SYSTEM_ADMIN', 'Super_Admin'] as const satisfies readonly IhsRole[];

export function isIhsRole(value: unknown): value is IhsRole {
  return typeof value === 'string' && (IHS_ROLES as readonly string[]).includes(value);
}

export function isSuperAdminRole(value: unknown): value is (typeof SUPER_ADMIN_ROLES)[number] {
  return typeof value === 'string' && (SUPER_ADMIN_ROLES as readonly string[]).includes(value);
}

/** Roles permitted on each Phase 2 surface. */
export const APP_ROLE_POLICY = {
  patientPortal: ['PATIENT'] as const satisfies readonly IhsRole[],
  clinicalWorkspace: ['PHYSICIAN'] as const satisfies readonly IhsRole[],
  operationsHub: ['DISPATCHER', 'SYSTEM_ADMIN', 'Super_Admin'] as const satisfies readonly IhsRole[],
} as const;
