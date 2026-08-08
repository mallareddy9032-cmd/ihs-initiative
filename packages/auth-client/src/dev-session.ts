import { SignJWT } from 'jose';
import {
  AUTH_ALGORITHMS,
  AUTH_TTL_SECONDS,
  LOCAL_DEV_JWT_SECRET,
  LOCAL_DEV_SUPER_ADMIN_UID,
} from './constants';
import { isValidPinFormat, normalizeUid } from './credentials';

export const LOCAL_DEV_SUPER_ADMIN_SCOPES = [
  'superadmin:tenant:write',
  'ops:dispatch:read',
] as const;

export function isLocalDevSuperAdminLogin(uid: string, pin: string): boolean {
  return normalizeUid(uid) === LOCAL_DEV_SUPER_ADMIN_UID && /^\d{6}$/.test(pin) && isValidPinFormat(pin);
}

/**
 * Issues a mock Super_Admin session for local development / unreachable Cloud Engine.
 * Claims: role Super_Admin, scopes superadmin:tenant:write + ops:dispatch:read, AAL2.
 */
export async function mintLocalDevSuperAdminToken(
  secret: string = LOCAL_DEV_JWT_SECRET,
): Promise<string> {
  if (!secret) {
    throw new Error('Cannot mint local development session without a JWT secret.');
  }

  const scopes = [...LOCAL_DEV_SUPER_ADMIN_SCOPES];
  const key = new TextEncoder().encode(secret);

  return new SignJWT({
    role: 'Super_Admin',
    name: 'Local Super Admin',
    scopes,
    scope: scopes.join(' '),
    aal: 'AAL2',
    acr: 'AAL2',
  })
    .setProtectedHeader({ alg: AUTH_ALGORITHMS[0] })
    .setSubject(LOCAL_DEV_SUPER_ADMIN_UID)
    .setIssuedAt()
    .setExpirationTime(`${AUTH_TTL_SECONDS}s`)
    .sign(key);
}
