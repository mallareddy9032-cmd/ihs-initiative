// ============================================================================
// FILE: src/utils/jwt.ts
// CONTEXT: Cryptographic Token Generation & Validation
// ============================================================================

import jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET_KEY || 'FATAL_UNCONFIGURED_SECRET';
const EXPIRES_IN = '12h'; // Strict 12-hour shift expiration

export interface JwtPayload {
  internal_id: string;
  ihs_uid: string;
  role: 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM_ADMIN';
}

export class JwtEngine {
  /**
   * Generates a signed JWT for the authenticated operator.
   */
  static generateToken(payload: JwtPayload): string {
    const secret = JWT_SECRET();
    if (secret === 'FATAL_UNCONFIGURED_SECRET') {
      console.warn('CRITICAL WARNING: Using default JWT secret in production!');
    }

    return jwt.sign(payload, secret, {
      algorithm: 'HS256',
      expiresIn: EXPIRES_IN,
    });
  }

  /**
   * Verifies and decodes an incoming JWT. Throws an error if expired or tampered.
   */
  static verifyToken(token: string): JwtPayload {
    return jwt.verify(token, JWT_SECRET()) as JwtPayload;
  }
}
