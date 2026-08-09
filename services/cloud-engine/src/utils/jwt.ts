// ============================================================================
// FILE: src/utils/jwt.ts
// CONTEXT: Cryptographic Token Generation & Validation
// ============================================================================

import jwt from 'jsonwebtoken';

/** Align with @ihs/auth-client local secret when JWT_SECRET_KEY is unset. */
const LOCAL_DEV_JWT_SECRET = 'IHS_LOCAL_DEV_JWT_SECRET_DO_NOT_USE_IN_PROD';

const JWT_SECRET = () => {
  const configured = process.env.JWT_SECRET_KEY;
  if (configured && configured.trim().length > 0 && configured !== 'FATAL_UNCONFIGURED_SECRET') {
    return configured;
  }
  return LOCAL_DEV_JWT_SECRET;
};
const EXPIRES_IN = '12h'; // Strict 12-hour shift expiration

export interface JwtPayload {
  internal_id: string;
  ihs_uid: string;
  role: 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM_ADMIN' | 'PATIENT' | 'Super_Admin';
}

export class JwtEngine {
  /**
   * Generates a signed JWT for the authenticated operator.
   */
  static generateToken(payload: JwtPayload): string {
    const secret = JWT_SECRET();

    // Include `sub` so Next.js middleware (@ihs/auth-client) can verify claims.
    return jwt.sign(
      {
        ...payload,
        sub: payload.ihs_uid,
        name: payload.ihs_uid,
      },
      secret,
      {
        algorithm: 'HS256',
        expiresIn: EXPIRES_IN,
      },
    );
  }

  /**
   * Verifies and decodes an incoming JWT. Throws an error if expired or tampered.
   */
  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET()) as JwtPayload;
  }
}
