import { SignJWT } from 'jose';
import {
  isSuperAdminRole,
  SUPERADMIN_TENANT_WRITE_SCOPE,
  type IhsAuthClaims,
} from '@ihs/types';
import { AUTH_ALGORITHMS, AUTH_TTL_SECONDS, LOCAL_DEV_JWT_SECRET } from './constants';

/**
 * Mints a new HS256 session JWT elevated to AAL3 with Super Admin write scope.
 * Used after successful hardware-key / TOTP step-up verification.
 */
export async function mintAal3SuperAdminToken(
  claims: IhsAuthClaims,
  secret: string,
): Promise<string> {
  const signingSecret =
    !secret || secret === 'FATAL_UNCONFIGURED_SECRET' ? LOCAL_DEV_JWT_SECRET : secret;

  if (!isSuperAdminRole(claims.role)) {
    throw new Error('Only Super Admin sessions may elevate to AAL3.');
  }

  const scopes = Array.from(
    new Set([...claims.scopes, SUPERADMIN_TENANT_WRITE_SCOPE]),
  );

  const key = new TextEncoder().encode(signingSecret);
  return new SignJWT({
    role: claims.role,
    name: claims.name ?? claims.sub,
    scopes,
    scope: scopes.join(' '),
    aal: 3,
    acr: 'AAL3',
  })
    .setProtectedHeader({ alg: AUTH_ALGORITHMS[0] })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(key);
}
