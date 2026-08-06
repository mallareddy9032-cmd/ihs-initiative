// ============================================================================
// FILE: src/communication/rest/TelemetrySyncController.ts
// CONTEXT: IHS Cloud Engine - Offline Batch Ingestion & Validation
// ============================================================================

import { Request, Response } from 'express';
import { ihsDbClient } from '../../infrastructure/database/client';

interface TelemetryRecordInput {
  device_mac_address?: string;
  service_uuid: string;
  reading_payload: unknown;
  is_manual_fallback?: boolean;
  photo_verification_b64?: string | null;
  recorded_at: string;
  variance_fraud_flag?: boolean;
}

export class TelemetrySyncController {
  static async ingestBatch(req: Request, res: Response) {
    try {
      const { case_id, telemetry_records } = req.body as {
        case_id?: string;
        telemetry_records?: TelemetryRecordInput[];
      };

      if (!case_id || !Array.isArray(telemetry_records)) {
        return res.status(400).json({ error: 'MALFORMED_PAYLOAD' });
      }

      // 1. Strict Validation: Pre-flight check for Anti-Fraud Fallbacks
      for (const record of telemetry_records) {
        if (!record.service_uuid || !record.recorded_at) {
          return res.status(400).json({
            error: 'MALFORMED_PAYLOAD',
            message: 'Each telemetry record requires service_uuid and recorded_at.',
          });
        }

        if (record.is_manual_fallback === true) {
          // PRD P4-2.2: Manual entries MUST have photographic verification (<300KB Base64)
          if (!record.photo_verification_b64 || record.photo_verification_b64.trim() === '') {
            return res.status(400).json({
              error: 'COMPLIANCE_BREACH',
              message:
                'Manual telemetry entry rejected. Missing required photographic verification.',
            });
          }

          // Reject oversized Base64 payloads (~300KB binary ≈ 400KB Base64)
          const approxBytes = Buffer.byteLength(record.photo_verification_b64, 'utf8');
          if (approxBytes > 400_000) {
            return res.status(400).json({
              error: 'COMPLIANCE_BREACH',
              message: 'Photo verification exceeds 300KB compressed limit.',
            });
          }

          // Verify Base64 integrity before DB write
          try {
            const decoded = Buffer.from(record.photo_verification_b64, 'base64');
            if (decoded.length === 0) {
              return res.status(400).json({
                error: 'COMPLIANCE_BREACH',
                message: 'Photo verification Base64 decoded to empty buffer.',
              });
            }
          } catch {
            return res.status(400).json({
              error: 'COMPLIANCE_BREACH',
              message: 'Photo verification Base64 is malformed.',
            });
          }
        }
      }

      // Confirm case exists before batch insert
      const clinicalCase = await ihsDbClient.clinicalCase.findUnique({
        where: { case_id },
        select: { case_id: true, is_locked: true },
      });

      if (!clinicalCase) {
        return res.status(404).json({ error: 'CASE_NOT_FOUND' });
      }

      if (clinicalCase.is_locked) {
        return res.status(403).json({
          error: 'WORM_LOCKED',
          message: 'Cannot ingest telemetry into a locked clinical case.',
        });
      }

      // 2. Batch Insert to PostgreSQL Hot Store (Using Prisma createMany)
      const mappedRecords = telemetry_records.map((record) => ({
        case_id,
        device_mac_address: record.device_mac_address || 'MANUAL_ENTRY',
        service_uuid: record.service_uuid,
        reading_value: JSON.stringify(record.reading_payload ?? {}),
        is_manual_fallback: record.is_manual_fallback || false,
        photo_verification_b64: record.photo_verification_b64 || null,
        variance_fraud_flag: record.variance_fraud_flag || false,
        recorded_at: new Date(record.recorded_at),
      }));

      const result = await ihsDbClient.diagnosticTelemetry.createMany({
        data: mappedRecords,
      });

      // 3. Acknowledge Receipt (Instructs Android SQLite to flush its local buffer)
      return res.status(201).json({
        success: true,
        records_ingested: result.count,
        message: 'Batch telemetry successfully synced and verified.',
      });
    } catch (error) {
      console.error('Telemetry Sync Error:', error);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
}
