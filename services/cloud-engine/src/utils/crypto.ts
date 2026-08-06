// ============================================================================
// FILE: src/utils/crypto.ts
// CONTEXT: NMC/DPDP WORM Compliance & E-Signatures
// ============================================================================

import crypto from 'crypto';

/**
 * Generates a deterministic SHA-256 hash for a given string payload.
 * Used for locking medical records and electronic prescriptions.
 */
export function generateSha256(payload: string): string {
  if (!payload || payload.trim() === '') {
    throw new Error('CRITICAL: Cannot generate hash for an empty payload.');
  }

  return crypto.createHash('sha256').update(payload).digest('hex');
}
