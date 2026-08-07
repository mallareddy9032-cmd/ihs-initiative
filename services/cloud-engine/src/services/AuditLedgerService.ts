// ============================================================================
// FILE: src/services/AuditLedgerService.ts
// CONTEXT: SHA-256 hash-chained immutable audit ledger (WORM)
// ============================================================================

import { ihsDbClient, type IhsDbClient } from '../infrastructure/database/client';
import {
  AUDIT_GENESIS_HASH,
  computeChainedAuditHash,
  generateSha256,
} from '../utils/crypto';

export interface AuditAppendInput {
  ihs_uid: string;
  event_type: string;
  actor_id: string;
  /** Canonical object — will be JSON.stringified deterministically for hashing. */
  payload: Record<string, unknown>;
}

export interface AuditChainRow {
  audit_id: string;
  ihs_uid: string;
  event_type: string;
  actor_id: string;
  cryptographic_hash: string;
  previous_hash: string;
  immutable_payload: string;
  created_at: Date;
}

export interface AuditChainVerification {
  valid: boolean;
  checked: number;
  broken_at?: number;
  reason?: string;
  tip_hash?: string;
  genesis: string;
  database_url_scheme: string;
}

type TxClient = Parameters<Parameters<IhsDbClient['$transaction']>[0]>[0];

/** Stable JSON for hashing (sorted keys, no whitespace drift). */
export function canonicalizeAuditPayload(payload: Record<string, unknown>): string {
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sorted);
    if (value && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = sorted(obj[key]);
          return acc;
        }, {});
    }
    return value;
  };
  return JSON.stringify(sorted(payload));
}

function databaseUrlScheme(): string {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  if (url.startsWith('file:')) return 'sqlite';
  return url.split(':')[0] || 'unknown';
}

async function tipHash(client: TxClient | IhsDbClient): Promise<string> {
  const last = await client.auditLog.findFirst({
    orderBy: [{ created_at: 'desc' }, { audit_id: 'desc' }],
    select: { cryptographic_hash: true },
  });
  return last?.cryptographic_hash || AUDIT_GENESIS_HASH;
}

export class AuditLedgerService {
  /**
   * Append a WORM audit event linked to the current chain tip.
   * Pass `tx` when already inside a Prisma transaction to avoid nested forks.
   */
  static async append(
    input: AuditAppendInput,
    tx?: TxClient,
  ): Promise<AuditChainRow> {
    const write = async (client: TxClient) => {
      const previousHash = await tipHash(client);
      const immutablePayload = canonicalizeAuditPayload({
        ...input.payload,
        event_type: input.event_type,
        ihs_uid: input.ihs_uid,
        actor_id: input.actor_id,
      });
      const cryptographicHash = computeChainedAuditHash(previousHash, immutablePayload);

      const row = await client.auditLog.create({
        data: {
          ihs_uid: input.ihs_uid,
          event_type: input.event_type,
          actor_id: input.actor_id,
          previous_hash: previousHash,
          cryptographic_hash: cryptographicHash,
          immutable_payload: immutablePayload,
        },
      });

      return row as AuditChainRow;
    };

    if (tx) return write(tx);
    return ihsDbClient.$transaction(async (inner) => write(inner as TxClient));
  }

  /** Legacy helper — still produces a payload hash but prefer append() for chaining. */
  static hashPayload(payload: Record<string, unknown>): string {
    return generateSha256(canonicalizeAuditPayload(payload));
  }

  static async listOrdered(): Promise<AuditChainRow[]> {
    const rows = await ihsDbClient.auditLog.findMany({
      orderBy: [{ created_at: 'asc' }, { audit_id: 'asc' }],
    });
    return rows as AuditChainRow[];
  }

  /**
   * Walk the ledger and confirm every link: previous_hash + payload → cryptographic_hash.
   * Prefers a genesis-rooted chain; otherwise accepts the longest self-consistent suffix
   * (covers legacy unchained rows that predate previous_hash).
   */
  static async verifyChain(): Promise<AuditChainVerification> {
    const rows = await AuditLedgerService.listOrdered();
    const scheme = databaseUrlScheme();

    if (rows.length === 0) {
      return {
        valid: true,
        checked: 0,
        tip_hash: AUDIT_GENESIS_HASH,
        genesis: AUDIT_GENESIS_HASH,
        database_url_scheme: scheme,
      };
    }

    const trySegment = (start: number): AuditChainVerification | null => {
      let expectedPrev = rows[start].previous_hash;
      if (!expectedPrev || expectedPrev.length !== 64) return null;

      for (let i = start; i < rows.length; i++) {
        const row = rows[i];
        if (row.previous_hash !== expectedPrev) return null;
        const recomputed = computeChainedAuditHash(row.previous_hash, row.immutable_payload);
        if (recomputed !== row.cryptographic_hash) return null;
        expectedPrev = row.cryptographic_hash;
      }

      return {
        valid: true,
        checked: rows.length - start,
        tip_hash: expectedPrev,
        genesis: AUDIT_GENESIS_HASH,
        database_url_scheme: scheme,
      };
    };

    // Prefer genesis-rooted segments (newest genesis start wins as scan order).
    const genesisStarts: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].previous_hash === AUDIT_GENESIS_HASH) genesisStarts.push(i);
    }
    for (let g = genesisStarts.length - 1; g >= 0; g--) {
      const result = trySegment(genesisStarts[g]);
      if (result) return result;
    }

    // Fallback: longest valid suffix (legacy → chained cutover).
    for (let start = 0; start < rows.length; start++) {
      const result = trySegment(start);
      if (result) return result;
    }

    return {
      valid: false,
      checked: 0,
      broken_at: 0,
      reason: 'No unbroken SHA-256 chain segment found in AuditLog',
      genesis: AUDIT_GENESIS_HASH,
      database_url_scheme: scheme,
    };
  }
}
