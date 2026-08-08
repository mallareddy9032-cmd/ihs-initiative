import { jwtVerify, type JWTPayload } from 'jose';
import {
  isIhsRole,
  type AuthenticatorAssuranceLevel,
  type IhsAuthClaims,
  type IhsRole,
} from '@ihs/types';
import { AUTH_ALGORITHMS, LOCAL_DEV_JWT_SECRET } from './constants';

function parseScopes(payload: JWTPayload): string[] {
  const raw = payload.scopes ?? payload.scope;
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseAal(payload: JWTPayload): AuthenticatorAssuranceLevel {
  const raw = payload.aal ?? payload.acr;
  if (raw === 3 || raw === '3' || raw === 'AAL3' || raw === 'aal3') return 3;
  if (raw === 2 || raw === '2' || raw === 'AAL2' || raw === 'aal2') return 2;
  return 1;
}

function toClaims(payload: JWTPayload): IhsAuthClaims | null {
  const sub = typeof payload.sub === 'string' ? payload.sub : null;
  const roleRaw = payload.role;
  if (!sub || !isIhsRole(roleRaw)) {
    return null;
  }
  const name = typeof payload.name === 'string' ? payload.name : undefined;
  const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  return {
    sub,
    role: roleRaw,
    name,
    scopes: parseScopes(payload),
    aal: parseAal(payload),
    iat,
    exp,
  };
}

/**
 * Cryptographically verifies an IHS HS256 session JWT.
 * Returns null on any failure (expired, bad signature, missing claims).
 */
export function resolveJwtSecret(secret: string): string {
  if (!secret || secret === 'FATAL_UNCONFIGURED_SECRET') {
    return LOCAL_DEV_JWT_SECRET;
  }
  return secret;
}

export async function verifyAuthToken(
  token: string,
  secret: string,
): Promise<IhsAuthClaims | null> {
  if (!token) {
    return null;
  }
  const resolved = resolveJwtSecret(secret);
  try {
    const key = new TextEncoder().encode(resolved);
    const { payload } = await jwtVerify(token, key, {
      algorithms: [...AUTH_ALGORITHMS],
    });
    return toClaims(payload);
  } catch {
    return null;
  }
}

export function roleAllowed(role: IhsRole, allowed: readonly IhsRole[]): boolean {
  return allowed.includes(role);
}
