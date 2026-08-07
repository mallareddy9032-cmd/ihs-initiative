// ============================================================================
// FILE: src/scripts/verify-audit-chain.ts
// CONTEXT: SHA-256 audit ledger write + unbroken hash-chain validation
// ============================================================================

import '../bootstrapEnv';

import { AuditLedgerService } from '../services/AuditLedgerService';
import { AUDIT_GENESIS_HASH, computeChainedAuditHash } from '../utils/crypto';

const DEMO_EVENTS = [
  {
    ihs_uid: 'IHS-8802',
    event_type: 'SOS_TRIGGERED',
    actor_id: 'PATIENT-VAULT',
    payload: { subject: 'Patient #IHS-8802', sector: 'Ananthapur Urban' },
  },
  {
    ihs_uid: 'IHS-8802',
    event_type: 'DISPATCH_ACK',
    actor_id: 'ALS-01',
    payload: { subject: 'Unit #ALS-01', grid: 'Ananthapur 50km' },
  },
  {
    ihs_uid: 'IHS-8802',
    event_type: 'ER_BED_RESERVED',
    actor_id: 'GGH-ER',
    payload: { subject: 'Bay T-03 GGH Ananthapuramu', bay: 'T-03' },
  },
] as const;

function describeDatabase(): { scheme: string; target: string; isPostgres: boolean } {
  const url = process.env.DATABASE_URL || '';
  const isPostgres = url.startsWith('postgresql://') || url.startsWith('postgres://');
  const scheme = isPostgres ? 'postgresql' : url.startsWith('file:') ? 'sqlite' : 'unknown';
  let target = url;
  if (isPostgres) {
    try {
      const u = new URL(url);
      target = `${u.protocol}//${u.hostname}:${u.port || '5432'}${u.pathname}`;
    } catch {
      target = 'postgresql://***';
    }
  }
  return { scheme, target, isPostgres };
}

async function main() {
  const db = describeDatabase();
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' IHS SHA-256 Audit Chain Validation');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(` Database scheme : ${db.scheme}`);
  console.log(` DATABASE_URL    : ${db.target}`);
  console.log(` Genesis         : ${AUDIT_GENESIS_HASH.slice(0, 16)}…`);

  if (!db.isPostgres) {
    console.log('');
    console.log(' ⚠  PostgreSQL is not configured on this host.');
    console.log('    Validating unbroken hash chains on the active Prisma DB.');
    console.log('    To target Postgres, set:');
    console.log('    DATABASE_URL="postgresql://ihs:ihs@localhost:5432/ihs_cloud_engine?schema=public"');
    console.log('    then: npx prisma db push && npm run test:audit-chain');
  }

  // Ensure schema includes previous_hash (db push should already have run).
  try {
    await AuditLedgerService.listOrdered();
  } catch (err) {
    console.error('\n ✗ Cannot read AuditLog — run: npx prisma generate && npx prisma db push');
    console.error(err);
    process.exit(2);
  }

  console.log('\n → Appending 3 chained audit events…');
  const written = [];
  for (const event of DEMO_EVENTS) {
    const row = await AuditLedgerService.append({
      ihs_uid: event.ihs_uid,
      event_type: event.event_type,
      actor_id: event.actor_id,
      payload: { ...event.payload },
    });
    written.push(row);
    console.log(
      `   [${row.event_type}] prev=${row.previous_hash.slice(0, 10)}… hash=${row.cryptographic_hash.slice(0, 10)}…`,
    );
  }

  // Local recomputation spot-check (independent of DB read)
  console.log('\n → Spot-checking recomputed hashes for written rows…');
  for (const row of written) {
    const recomputed = computeChainedAuditHash(row.previous_hash, row.immutable_payload);
    if (recomputed !== row.cryptographic_hash) {
      console.error(` ✗ Local recompute FAILED for ${row.event_type}`);
      process.exit(1);
    }
  }
  console.log('   Local recompute: PASS');

  console.log('\n → Walking full ledger chain via AuditLedgerService.verifyChain()…');
  const result = await AuditLedgerService.verifyChain();
  console.log(`   checked=${result.checked} scheme=${result.database_url_scheme}`);
  if (!result.valid) {
    console.error(` ✗ CHAIN BROKEN: ${result.reason}`);
    process.exit(1);
  }

  console.log(`   tip=${result.tip_hash?.slice(0, 16)}…`);
  console.log('\n ✓ PASS — Event logs wrote successfully with unbroken SHA-256 hash chains.');
  if (db.isPostgres) {
    console.log(' ✓ PostgreSQL ledger confirmed.');
  } else {
    console.log(' ✓ SQLite ledger confirmed (Postgres-ready schema / service path).');
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error(' ✗ Audit chain validation crashed:', err);
  process.exit(1);
});
