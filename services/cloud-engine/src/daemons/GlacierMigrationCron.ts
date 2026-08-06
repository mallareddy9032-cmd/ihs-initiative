// ============================================================================
// FILE: src/daemons/GlacierMigrationCron.ts
// CONTEXT: DPDP Day 31 Hot-to-Cold Shift
// ============================================================================

import cron from 'node-cron';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ihsDbClient } from '../infrastructure/database/client';
import { generateSha256 } from '../utils/crypto';

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-2' });
const GLACIER_BUCKET = process.env.GLACIER_BUCKET || 'ihs-antp-cold-vault-wrm';

export class DataComplianceDaemon {
  public static initialize(): void {
    cron.schedule('0 2 * * *', async () => {
      console.log('📦 [DAEMON] Initiating Day 31 Cold Vault Migration...');
      try {
        await this.executeHotToColdShift();
      } catch (error) {
        console.error('❌ [DAEMON] Glacier migration failed:', error);
      }
    });

    console.log('📦 [DAEMON] DataComplianceDaemon scheduled (cron: 0 2 * * *)');
  }

  private static async executeHotToColdShift(): Promise<void> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 30);

    const agingRecords = await ihsDbClient.diagnosticTelemetry.findMany({
      where: {
        recorded_at: { lt: thresholdDate },
        vault_status: 'HOT_STORE',
        photo_verification_b64: { not: null },
      },
    });

    if (agingRecords.length === 0) {
      console.log('📦 [DAEMON] No aging HOT_STORE media eligible for Glacier migration.');
      return;
    }

    let migratedCount = 0;

    for (const record of agingRecords) {
      try {
        if (!record.photo_verification_b64) continue;

        const salt = crypto.randomBytes(16).toString('hex');
        const tokenizedKey = crypto
          .createHash('sha256')
          .update(record.case_id + salt)
          .digest('hex');

        const objectKey = `vaults/telemetry/${record.recorded_at.getFullYear()}/${tokenizedKey}.img`;
        const buffer = Buffer.from(record.photo_verification_b64, 'base64');

        await s3.send(
          new PutObjectCommand({
            Bucket: GLACIER_BUCKET,
            Key: objectKey,
            Body: buffer,
            StorageClass: 'GLACIER',
            ServerSideEncryption: 'aws:kms',
          }),
        );

        let priorReading: Record<string, unknown> = {};
        try {
          priorReading = JSON.parse(record.reading_value || '{}') as Record<string, unknown>;
        } catch {
          priorReading = {};
        }

        await ihsDbClient.diagnosticTelemetry.update({
          where: { telemetry_id: record.telemetry_id },
          data: {
            photo_verification_b64: null,
            vault_status: 'AWS_GLACIER',
            glacier_uri: objectKey,
            reading_value: JSON.stringify({
              ...priorReading,
              anonymization_salt: salt,
            }),
          },
        });

        const auditPayload = {
          action: 'GLACIER_COLD_MIGRATION',
          telemetry_id: record.telemetry_id,
          glacier_uri: objectKey,
        };

        await ihsDbClient.auditLog.create({
          data: {
            ihs_uid: 'SYSTEM',
            event_type: 'GLACIER_COLD_MIGRATION',
            actor_id: '00000000-0000-0000-0000-000000000000',
            cryptographic_hash: generateSha256(JSON.stringify(auditPayload)),
            immutable_payload: JSON.stringify(auditPayload),
          },
        });

        migratedCount += 1;
      } catch (error) {
        console.error(`Failed to migrate record ${record.telemetry_id}:`, error);
      }
    }

    console.log(`✅ [DAEMON] Migrated ${migratedCount} records to Glacier.`);
  }
}
