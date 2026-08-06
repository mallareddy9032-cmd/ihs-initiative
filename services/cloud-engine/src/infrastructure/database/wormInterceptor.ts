// ============================================================================
// FILE: src/infrastructure/database/wormInterceptor.ts
// CONTEXT: IHS Cloud Engine - WORM Compliance Prisma Extension
// ============================================================================

import { PrismaClient } from '@prisma/client';

const FORBIDDEN_AUDIT_MUTATIONS = new Set([
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

function raiseWormViolation(model: string, operation: string): never {
  console.error(`🚨 [WORM_COMPLIANCE_BREACH_ATTEMPT] Illegal ${operation} on ${model}`);

  throw new Error(
    `DPDP/NMC WORM VIOLATION: The ${model} table is cryptographically immutable. ` +
      `Attempted operation '${operation}' has been blocked and logged.`,
  );
}

function isLockedClinicalRecord(record: {
  is_locked: boolean;
  current_status: string;
} | null): boolean {
  if (!record) return false;
  return record.is_locked === true || record.current_status === 'CLOSED_RESOLVED';
}

/**
 * Applies WORM (Write-Once-Read-Many) query interceptors to a PrismaClient.
 * - AuditLog: all UPDATE / DELETE / UPSERT paths are absolutely forbidden.
 * - ClinicalCase: UPDATE / DELETE / UPSERT blocked when locked / CLOSED_RESOLVED.
 */
export function applyWormComplianceInterceptor(baseClient: PrismaClient) {
  return baseClient.$extends({
    name: 'ihs-worm-compliance',
    query: {
      auditLog: {
        async $allOperations({ operation, args, query }) {
          if (FORBIDDEN_AUDIT_MUTATIONS.has(operation)) {
            raiseWormViolation('AuditLog', operation);
          }
          return query(args);
        },
      },
      clinicalCase: {
        async update({ args, query }) {
          const caseId = args.where.case_id;
          if (!caseId) {
            raiseWormViolation('ClinicalCase', 'update');
          }

          const existing = await baseClient.clinicalCase.findUnique({
            where: { case_id: caseId },
            select: { is_locked: true, current_status: true },
          });

          if (isLockedClinicalRecord(existing)) {
            raiseWormViolation('ClinicalCase', 'update');
          }

          return query(args);
        },

        async updateMany({ args, query }) {
          const lockedMatches = await baseClient.clinicalCase.count({
            where: {
              AND: [
                args.where ?? {},
                {
                  OR: [{ is_locked: true }, { current_status: 'CLOSED_RESOLVED' }],
                },
              ],
            },
          });

          if (lockedMatches > 0) {
            raiseWormViolation('ClinicalCase', 'updateMany');
          }

          return query(args);
        },

        async delete() {
          raiseWormViolation('ClinicalCase', 'delete');
        },

        async deleteMany() {
          raiseWormViolation('ClinicalCase', 'deleteMany');
        },

        async upsert({ args, query }) {
          const caseId = args.where.case_id;
          if (!caseId) {
            raiseWormViolation('ClinicalCase', 'upsert');
          }

          const existing = await baseClient.clinicalCase.findUnique({
            where: { case_id: caseId },
            select: { is_locked: true, current_status: true },
          });

          if (isLockedClinicalRecord(existing)) {
            raiseWormViolation('ClinicalCase', 'upsert');
          }

          return query(args);
        },
      },
    },
  });
}
