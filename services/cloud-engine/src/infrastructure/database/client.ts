// ============================================================================
// FILE: src/infrastructure/database/client.ts
// CONTEXT: IHS Cloud Engine - Prisma Client with WORM Interceptor
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { applyWormComplianceInterceptor } from './wormInterceptor';

const globalForPrisma = globalThis as unknown as {
  basePrisma?: PrismaClient;
};

const basePrisma =
  globalForPrisma.basePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.basePrisma = basePrisma;
}

/**
 * Canonical database client for the entire Cloud Engine.
 * All repositories MUST import ihsDbClient — never PrismaClient directly —
 * so the WORM interceptor wraps 100% of database traffic.
 */
export const ihsDbClient = applyWormComplianceInterceptor(basePrisma);

export type IhsDbClient = typeof ihsDbClient;
