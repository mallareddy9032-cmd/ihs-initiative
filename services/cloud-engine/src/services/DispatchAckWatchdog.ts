// ============================================================================
// FILE: src/services/DispatchAckWatchdog.ts
// CONTEXT: 30s ACCEPT DISPATCH timer → SMS fallback to standby driver
// ============================================================================

import { SmsService } from './sms.service';
import { DemoStore, isDemoMode } from '../infrastructure/demo/DemoStore';
import { ihsDbClient } from '../infrastructure/database/client';

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export class DispatchAckWatchdog {
  static arm(input: {
    caseId: string;
    fleetId: string;
    patientName: string;
    standbyPhone?: string | null;
  }): void {
    DispatchAckWatchdog.clear(input.caseId);

    const timer = setTimeout(() => {
      void DispatchAckWatchdog.fireIfUnacked(input);
    }, 30_000);

    pending.set(input.caseId, timer);
    console.log(`[AckWatchdog] Armed 30s timer case=${input.caseId} fleet=${input.fleetId}`);
  }

  static clear(caseId: string): void {
    const existing = pending.get(caseId);
    if (existing) {
      clearTimeout(existing);
      pending.delete(caseId);
    }
  }

  static acknowledge(caseId: string, status: string): void {
    if (status === 'ACCEPTED' || status === 'EN_ROUTE_PATIENT' || status === 'ON_SCENE') {
      if (pending.has(caseId)) {
        console.log(`[AckWatchdog] Cleared — driver accepted case=${caseId}`);
      }
      DispatchAckWatchdog.clear(caseId);
    }
  }

  private static async fireIfUnacked(input: {
    caseId: string;
    fleetId: string;
    patientName: string;
    standbyPhone?: string | null;
  }): Promise<void> {
    pending.delete(input.caseId);

    let driverStatus: string | undefined;
    if (isDemoMode()) {
      const c = DemoStore.getCaseWithPatient(input.caseId);
      driverStatus = c?.clinicalCase.driver_status;
    } else {
      const incident = await ihsDbClient.emergencyIncident.findUnique({
        where: { id: input.caseId },
      });
      driverStatus = incident?.driverStatus ?? undefined;
    }

    if (
      driverStatus === 'ACCEPTED' ||
      driverStatus === 'EN_ROUTE_PATIENT' ||
      driverStatus === 'ON_SCENE' ||
      driverStatus === 'TRANSPORTING' ||
      driverStatus === 'HANDOFF_COMPLETE'
    ) {
      console.log(`[AckWatchdog] Skip fallback — already ${driverStatus} case=${input.caseId}`);
      return;
    }

    let standbyPhone = input.standbyPhone;
    if (!standbyPhone) {
      const unit = await ihsDbClient.fleetUnit
        .findUnique({ where: { vehicleNumber: input.fleetId } })
        .catch(() => null);
      standbyPhone = unit?.standbyPhone ?? null;
    }

    console.warn(`[AckWatchdog] No ACCEPT within 30s — SMS fallback case=${input.caseId}`);
    await SmsService.sendDispatchAckFallback({
      standbyPhone,
      fleetId: input.fleetId,
      caseId: input.caseId,
      patientName: input.patientName,
    });
  }
}
