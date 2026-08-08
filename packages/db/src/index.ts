import { createMockDbClient, type IhsDbClient } from './mock';

export type {
  ClinicalChart,
  ClinicalChartWithRx,
  DispatchRecord,
  DispatchStatus,
  EPrescription,
  Patient,
  TriageCase,
  TriageCaseWithDispatch,
  TriageServiceType,
  TriageStatus,
  VaultObject,
} from './types';
export type { IhsDbClient } from './mock';
export { createMockDbClient } from './mock';

const globalForDb = globalThis as typeof globalThis & {
  __IHS_DB__?: IhsDbClient;
};

/**
 * Singleton data-plane client.
 * Phase 4 local development uses an in-memory mock implementing TriageCase,
 * DispatchRecord, VaultObject, and ClinicalChart workflows.
 * `prisma/schema.prisma` is the source of truth for PostgreSQL migrations
 * (`pnpm --filter @ihs/db generate` + migrate when DATABASE_URL is provisioned).
 */
export const db: IhsDbClient = globalForDb.__IHS_DB__ ?? createMockDbClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__IHS_DB__ = db;
}

export function getDbMode(): 'mock' | 'prisma' {
  return db.mode;
}

export default db;
