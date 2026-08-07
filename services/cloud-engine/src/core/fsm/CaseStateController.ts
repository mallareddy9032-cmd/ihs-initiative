// ============================================================================
// FILE: src/core/fsm/CaseStateController.ts
// CONTEXT: IHS Cloud Engine - Master FSM & Capitation Gate
// ============================================================================

import { ihsDbClient } from '../../infrastructure/database/client';
import { AuditLedgerService } from '../../services/AuditLedgerService';
import { DispatchSlaMetrics } from '../../infrastructure/metrics/DispatchSlaMetrics';
import { ExecutiveAnalytics } from '../../infrastructure/analytics/ExecutiveAnalytics';
import { StateEmergencyRedirectService } from '../../services/StateEmergencyRedirectService';
import { WebSocketEngine } from '../../communication/websockets/WebSocketEngine';

export class CaseStateController {
  static async attemptDispatch(caseId: string, patientId: string, dispatcherId: string) {
    return await ihsDbClient.$transaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { patientId, status: 'ACTIVE' },
      });

      if (!subscription || subscription.doorstepVisitsRemaining <= 0) {
        return { success: false as const, requiresCoPay: true, fee: 499 };
      }

      const existingCase = await tx.clinicalCase.findUnique({
        where: { case_id: caseId },
      });

      if (!existingCase || existingCase.current_status !== 'INITIATED') {
        throw new Error(
          `Invalid State Transition: Case ${caseId} must be INITIATED to dispatch.`,
        );
      }

      if (existingCase.is_mlc) {
        throw new Error(
          'MLC_STATUTORY_REDIRECT: Case is medico-legal. Patch to 108/112 — IHS fleet dispatch blocked.',
        );
      }

      if (existingCase.is_locked) {
        throw new Error(`WORM: Case ${caseId} is locked and cannot be dispatched.`);
      }

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { doorstepVisitsRemaining: { decrement: 1 } },
      });

      const tA = new Date();
      const updatedCase = await tx.clinicalCase.update({
        where: { case_id: caseId },
        data: {
          current_status: 'DISPATCHED',
          t_a: tA,
        },
      });

      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient) {
        throw new Error(`CRITICAL: Patient ${patientId} not found during dispatch audit.`);
      }

      await AuditLedgerService.append(
        {
          ihs_uid: patient.ihsUid,
          event_type: 'DISPATCH_AUTHORIZED',
          actor_id: dispatcherId,
          payload: {
            action: 'DISPATCH_AUTHORIZED',
            case_id: caseId,
            remaining_quota: subscription.doorstepVisitsRemaining - 1,
          },
        },
        tx as never,
      );

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

      ExecutiveAnalytics.noteIncidentEvent('vizag');

      return { success: true as const, updatedCase };
    });
  }

  static async markArrived(caseId: string) {
    const currentCase = await ihsDbClient.clinicalCase.findUnique({
      where: { case_id: caseId },
    });
    if (currentCase?.current_status === 'DISPATCHED' && !currentCase.t_m) {
      const tM = new Date();
      await ihsDbClient.clinicalCase.update({
        where: { case_id: caseId },
        data: { t_m: tM, current_status: 'ARRIVED_ON_SCENE' },
      });
      const start =
        (currentCase as { created_at?: Date }).created_at || currentCase.t_a || null;
      if (start instanceof Date) {
        DispatchSlaMetrics.observeTatSeconds((tM.getTime() - start.getTime()) / 1000, 'on_scene');
      }
    }
  }

  /**
   * Global MLC override — statutory 108/112 is kicked fire-and-forget BEFORE
   * any slower side effects (BLS unlock / WebRTC). Engine never awaits redirect I/O.
   */
  static async triggerSafeHarborMlc(caseId: string, actorId: string) {
    const updatedCase = await ihsDbClient.clinicalCase.update({
      where: { case_id: caseId },
      data: { current_status: 'SAFE_HARBOR_MLC', is_mlc: true, is_locked: true },
    });

    const patient = await ihsDbClient.patient.findUnique({
      where: { id: updatedCase.patient_id },
    });

    const ihsUid = patient?.ihsUid || 'UNKNOWN';

    // 1) Statutory redirect FIRST — synchronous kick, zero await on network
    const redirect = StateEmergencyRedirectService.kickStatutoryRedirect({
      caseId,
      ihsUid,
      actorId,
      reason: 'SAFE_HARBOR_MLC',
    });

    await AuditLedgerService.append({
      ihs_uid: ihsUid,
      event_type: 'MLC_SAFE_HARBOR_TRIGGERED',
      actor_id: actorId,
      payload: {
        caseId,
        action: 'SAFE_HARBOR',
        statutory: redirect.tel,
        channels: redirect.channels,
      },
    });

    // 2) Notify Command Center immediately (local WS — no statutory wait)
    WebSocketEngine.broadcastToDispatchers({
      event: 'SAFE_HARBOR_MLC',
      payload: {
        case_id: caseId,
        ihs_uid: ihsUid,
        statutory: redirect.tel,
        dial_hints: redirect.dial_hints,
        script: redirect.script,
        timestamp: new Date().toISOString(),
      },
    });

    // 3) Local clinical side-effects — never gate 108/112
    void CaseStateController.unlockTabletBlsDrugs(caseId);
    void CaseStateController.openSilentWebRtcMonitor(caseId);

    return { case: updatedCase, redirect };
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

  private static async unlockTabletBlsDrugs(caseId: string) {
    console.log(`[FSM] BLS unlock stub case=${caseId}`);
  }

  private static async openSilentWebRtcMonitor(caseId: string) {
    console.log(`[FSM] WebRTC monitor stub case=${caseId}`);
  }
}
