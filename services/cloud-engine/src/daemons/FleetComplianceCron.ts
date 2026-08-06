// ============================================================================
// FILE: src/daemons/FleetComplianceCron.ts
// CONTEXT: Midnight Fleet Audit & Active Grounding
// ============================================================================

import cron from 'node-cron';
import { ihsDbClient } from '../infrastructure/database/client';
import { WebSocketEngine } from '../communication/websockets/WebSocketEngine';

export class FleetComplianceDaemon {
  public static initialize(): void {
    // Run every day at 00:00 (Midnight)
    cron.schedule('0 0 * * *', async () => {
      console.log('🛡️ [DAEMON] Initiating Daily Fleet Compliance Audit...');
      try {
        await this.auditAndGroundAssets();
      } catch (error) {
        console.error('❌ [DAEMON] Fleet compliance audit failed:', error);
      }
    });

    console.log('🛡️ [DAEMON] FleetComplianceDaemon scheduled (cron: 0 0 * * *)');
  }

  private static async auditAndGroundAssets(): Promise<void> {
    const today = new Date();

    // 1. Identify non-compliant active vehicles
    const expiredAssets = await ihsDbClient.fleetAsset.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { insurance_expiry_date: { lt: today } },
          { fitness_cert_expiry: { lt: today } },
        ],
      },
    });

    if (expiredAssets.length === 0) {
      console.log('✅ [DAEMON] All active fleet assets are compliant.');
      return;
    }

    // 2. Ground the vehicles immediately
    const assetIds = expiredAssets.map((asset) => asset.fleet_id);

    await ihsDbClient.fleetAsset.updateMany({
      where: { fleet_id: { in: assetIds } },
      data: { status: 'INACTIVE_NON_COMPLIANT' },
    });

    // 3. Alert the Command Center to reroute pending morning dispatches
    expiredAssets.forEach((asset) => {
      console.warn(`🚨 GROUNDED: Fleet ${asset.fleet_id} due to document expiration.`);

      WebSocketEngine.broadcastToDispatchers({
        event: 'FLEET_ASSET_GROUNDED',
        payload: {
          fleet_id: asset.fleet_id,
          operator: asset.operator_name,
          reason: 'COMPLIANCE_EXPIRATION',
          action_required: 'REROUTE_ASSIGNED_CASES',
        },
      });
    });
  }
}
