import type { IhsRole } from './roles';

/** NIST-style authenticator assurance level carried on the session JWT. */
export type AuthenticatorAssuranceLevel = 1 | 2 | 3;

/** Privileged Super Admin write scope for tenant control-plane mutations. */
export const SUPERADMIN_TENANT_WRITE_SCOPE = 'superadmin:tenant:write' as const;

export type IhsScope = typeof SUPERADMIN_TENANT_WRITE_SCOPE | (string & {});

export interface IhsOperator {
  uid: string;
  name: string;
  role: IhsRole;
}

export interface IhsAuthClaims {
  sub: string;
  role: IhsRole;
  name?: string;
  /** OAuth-style scopes granted to the session (e.g. superadmin:tenant:write). */
  scopes: string[];
  /** Authenticator Assurance Level; Super Admin mutations require AAL3. */
  aal: AuthenticatorAssuranceLevel;
  iat?: number;
  exp?: number;
}

export interface IhsLoginRequest {
  ihs_uid: string;
  pin: string;
}

export interface IhsLoginSuccess {
  success: true;
  token: string;
  operator: IhsOperator;
  message?: string;
}

export interface IhsLoginFailure {
  success: false;
  error: string;
}

export type IhsLoginResponse = IhsLoginSuccess | IhsLoginFailure;
