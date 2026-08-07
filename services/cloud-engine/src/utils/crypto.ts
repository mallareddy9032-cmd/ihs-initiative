// ============================================================================
// FILE: src/utils/crypto.ts
// CONTEXT: NMC/DPDP WORM Compliance & E-Signatures
// ============================================================================

import crypto from 'crypto';

/** Genesis previous_hash — first block in an unbroken SHA-256 audit chain. */
export const AUDIT_GENESIS_HASH = '0'.repeat(64);

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

/**
 * Hash-chain link: SHA-256(previous_hash | immutable_payload)
 * Binding prior tip + current payload prevents silent ledger rewrites.
 */
export function computeChainedAuditHash(previousHash: string, immutablePayload: string): string {
  if (!previousHash || previousHash.length !== 64) {
    throw new Error('CRITICAL: previous_hash must be a 64-char hex digest (or genesis).');
  }
  if (!immutablePayload || immutablePayload.trim() === '') {
    throw new Error('CRITICAL: Cannot chain-hash an empty immutable payload.');
  }
  return generateSha256(`${previousHash}|${immutablePayload}`);
}
