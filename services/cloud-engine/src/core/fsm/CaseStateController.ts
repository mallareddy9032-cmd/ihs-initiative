// ============================================================================
// FILE: src/core/fsm/CaseStateController.ts
// CONTEXT: IHS Cloud Engine - Master FSM & Capitation Gate
// ============================================================================

import { ihsDbClient } from '../../infrastructure/database/client';
import { generateSha256 } from '../../utils/crypto';

export class CaseStateController {
  static async attemptDispatch(caseId: string, patientId: string, dispatcherId: string) {
    return await ihsDbClient.$transaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { patientId, status: 'ACTIVE' },
      });

      if (!subscription || subscription.doorstepVisitsRemaining <= 0) {
        return { success: false as const, requiresCoPay: true, fee: 499 };
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { doorstepVisitsRemaining: { decrement: 1 } },
      });

      const existingCase = await tx.clinicalCase.findUnique({
        where: { case_id: caseId },
      });

      if (!existingCase || existingCase.current_status !== 'INITIATED') {
        throw new Error(
          `Invalid State Transition: Case ${caseId} must be INITIATED to dispatch.`,
        );
      }

      if (existingCase.is_locked) {
        throw new Error(`WORM: Case ${caseId} is locked and cannot be dispatched.`);
      }

      const updatedCase = await tx.clinicalCase.update({
        where: { case_id: caseId },
        data: {
          current_status: 'DISPATCHED',
          t_a: new Date(),
        },
      });

      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        throw new Error(`CRITICAL: Patient ${patientId} not found during dispatch audit.`);
      }

      const auditPayload = {
        action: 'DISPATCH_AUTHORIZED',
        remaining_quota: subscription.doorstepVisitsRemaining - 1,
      };

      await tx.auditLog.create({
        data: {
          ihs_uid: patient.ihsUid,
          event_type: 'SYSTEM_ACCESS',
          actor_id: dispatcherId,
          cryptographic_hash: generateSha256(JSON.stringify(auditPayload)),
          immutable_payload: JSON.stringify(auditPayload),
        },
      });

      await tx.emergencyIncident.upsert({
        where: { id: caseId },
        create: {
          id: caseId,
          patientId,
          status: 'DISPATCHED',
          fleetId: 'AMB-VSKP-07',
          driverId: 'AMB-VSKP-07',
        },
        update: {
          status: 'DISPATCHED',
          fleetId: 'AMB-VSKP-07',
          driverId: 'AMB-VSKP-07',
        },
      });

      return { success: true as const, updatedCase };
    });
  }

  static async markArrived(caseId: string) {
    const currentCase = await ihsDbClient.clinicalCase.findUnique({
      where: { case_id: caseId },
    });
    if (currentCase?.current_status === 'DISPATCHED' && !currentCase.t_m) {
      await ihsDbClient.clinicalCase.update({
        where: { case_id: caseId },
        data: { t_m: new Date(), current_status: 'ARRIVED_ON_SCENE' },
      });
    }
  }

  static async triggerSafeHarborMlc(caseId: string, actorId: string) {
    const updatedCase = await ihsDbClient.clinicalCase.update({
      where: { case_id: caseId },
      data: { current_status: 'SAFE_HARBOR_MLC', is_mlc: true },
    });

    const patient = await ihsDbClient.patient.findUnique({
      where: { id: updatedCase.patient_id },
    });

    await ihsDbClient.auditLog.create({
      data: {
        ihs_uid: patient?.ihsUid || 'UNKNOWN',
        event_type: 'MLC_SAFE_HARBOR_TRIGGERED',
        actor_id: actorId,
        cryptographic_hash: generateSha256(caseId),
        immutable_payload: JSON.stringify({ caseId, action: 'SAFE_HARBOR' }),
      },
    });

    await Promise.all([
      CaseStateController.fireParallelState108Webhook(caseId, patient?.ihsUid || 'UNKNOWN'),
      CaseStateController.unlockTabletBlsDrugs(caseId),
      CaseStateController.openSilentWebRtcMonitor(caseId),
    ]);

    return updatedCase;
  }

  static async escalateCriticalTransit(caseId: string) {
    const currentCase = await ihsDbClient.clinicalCase.findUnique({
      where: { case_id: caseId },
    });
    if (!currentCase) throw new Error('CASE_NOT_FOUND');
    if (currentCase.current_status !== 'TELECONSULT_ACTIVE') {
      return await ihsDbClient.clinicalCase.update({
        where: { case_id: caseId },
        data: { current_status: 'CRITICAL_TRANSIT_PENDING' },
      });
    }
    return currentCase;
  }

  static async closeCase(caseId: string) {
    return await ihsDbClient.$transaction(async (tx) => {
      return tx.clinicalCase.update({
        where: { case_id: caseId },
        data: {
          current_status: 'CLOSED_RESOLVED',
          is_locked: true,
          t_e: new Date(),
        },
      });
    });
  }

  private static async fireParallelState108Webhook(caseId: string, ihsUid: string) {
    console.log(`[FSM] 108 webhook stub case=${caseId} uid=${ihsUid}`);
  }

  private static async unlockTabletBlsDrugs(caseId: string) {
    console.log(`[FSM] BLS unlock stub case=${caseId}`);
  }

  private static async openSilentWebRtcMonitor(caseId: string) {
    console.log(`[FSM] WebRTC monitor stub case=${caseId}`);
  }
}
