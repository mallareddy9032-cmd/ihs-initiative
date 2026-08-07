// ============================================================================
// FILE: src/communication/rest/DispatchController.ts
// CONTEXT: Capitation gate + fleet mobilize endpoints for Command Center
// ============================================================================

import { Request, Response } from 'express';
import { DemoStore, isDemoMode } from '../../infrastructure/demo/DemoStore';
import { ihsDbClient } from '../../infrastructure/database/client';
import { CaseStateController } from '../../core/fsm/CaseStateController';
import { JwtEngine } from '../../utils/jwt';
import { DriverController } from '../websockets/DriverController';
import { calculateHaversineDistance } from '../../utils/geo';
import { StateEmergencyRedirectService } from '../../services/StateEmergencyRedirectService';

/** Default ALS unit staging near Prakasam Nagar (matches portal roster). */
const FLEET_STAGING: Record<string, { lat: number; lng: number; driver: string; hospital: string }> =
  {
    'AMB-VSKP-07': {
      lat: 17.734,
      lng: 83.306,
      driver: 'Ravi Kumar',
      hospital: 'KGH Visakhapatnam',
    },
    'AMB-VSKP-12': {
      lat: 17.728,
      lng: 83.314,
      driver: 'Suresh Naidu',
      hospital: 'Care Hospital Ramnagar',
    },
    'AMB-VSKP-03': {
      lat: 17.741,
      lng: 83.298,
      driver: 'Priya Devi',
      hospital: 'Apollo Health City',
    },
  };

function readOperator(req: Request) {
  const token = req.cookies?.ihs_auth_token as string | undefined;
  if (!token) return null;
  try {
    return JwtEngine.verifyToken(token);
  } catch {
    return null;
  }
}

export class DispatchController {
  /**
   * GET /v1/billing/mobilization-check
   * Capitation pre-check before MOBILIZE FLEET.
   */
  static async mobilizationCheck(req: Request, res: Response) {
    try {
      const ihsUid = String(req.query.ihs_uid || '').toUpperCase();
      if (!ihsUid) {
        return res.status(400).json({ error: 'MISSING_IHS_UID' });
      }

      if (isDemoMode()) {
        const patient = DemoStore.findPatientByUid(ihsUid);
        if (!patient) {
          return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
        }
        const check = DemoStore.mobilizeCheck(patient.internal_id);
        if (!check.ok) {
          return res.status(402).json({
            status: 'QUOTA_EXCEEDED',
            fee_required: check.fee,
            message: 'Monthly doorstep quota exceeded. ₹499 co-pay required to dispatch.',
          });
        }
        return res.status(200).json({
          status: 'APPROVED',
          fee_required: 0,
          visits_remaining: check.remaining,
        });
      }

      const patient = await ihsDbClient.patient.findUnique({ where: { ihsUid: ihsUid } });
      if (!patient) {
        return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
      }

      const subscription = await ihsDbClient.subscription.findFirst({
        where: { patientId: patient.id, status: 'ACTIVE' },
      });

      if (!subscription || subscription.doorstepVisitsRemaining <= 0) {
        return res.status(402).json({
          status: 'QUOTA_EXCEEDED',
          fee_required: 499,
          message: 'Monthly doorstep quota exceeded. ₹499 co-pay required to dispatch.',
        });
      }

      return res.status(200).json({
        status: 'APPROVED',
        fee_required: 0,
        visits_remaining: subscription.doorstepVisitsRemaining,
      });
    } catch (error) {
      console.error('mobilizationCheck failed', error);
      return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  /**
   * POST /v1/fsm/dispatch
   * Authorize ambulance / doorstep fleet mobilization.
   */
  static async dispatchFleet(req: Request, res: Response) {
    try {
      const operator = readOperator(req);
      const {
        case_id,
        patient_id,
        ihs_uid,
        override_reason,
        fleet_id,
      } = req.body as {
        case_id?: string;
        patient_id?: string;
        ihs_uid?: string;
        override_reason?: string;
        fleet_id?: string;
      };

      if (isDemoMode()) {
        let patientId = patient_id;
        let caseId = case_id;

        if (!patientId && ihs_uid) {
          patientId = DemoStore.findPatientByUid(ihs_uid)?.internal_id;
        }
        if (!patientId) {
          return res.status(400).json({ error: 'MISSING_PATIENT' });
        }

        if (!caseId) {
          caseId = DemoStore.createPanicCase(patientId).case_id;
        }

        const result = DemoStore.attemptDispatch(caseId, patientId, override_reason);
        if (!result.success) {
          return res.status(402).json({
            requiresCoPay: true,
            fee: result.fee,
            message: 'Quota exceeded',
          });
        }

        const assignedFleet = (fleet_id || result.fleet_id || 'AMB-VSKP-07').toUpperCase();
        result.case.assigned_fleet_id = assignedFleet;

        const patient = DemoStore.findPatientByInternalId(patientId);
        const staging = FLEET_STAGING[assignedFleet] || FLEET_STAGING['AMB-VSKP-07'];
        const liveGps = {
          lat: result.case.live_lat ?? patient?.home_lat ?? staging.lat,
          lng: result.case.live_lng ?? patient?.home_lng ?? staging.lng,
        };
        const homeGps = {
          lat: patient?.home_lat ?? liveGps.lat,
          lng: patient?.home_lng ?? liveGps.lng,
        };
        const distanceKm =
          Math.round((calculateHaversineDistance(staging, liveGps) / 1000) * 10) / 10;
        const etaMinutes = Math.max(4, Math.round(distanceKm * 2.8));

        const assignment = {
          case_id: result.case.case_id,
          fleet_id: assignedFleet,
          driver_name: staging.driver,
          patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'IHS Member',
          ihs_uid: patient?.ihs_uid ?? ihs_uid ?? 'UNKNOWN',
          patient_internal_id: patientId,
          patient_age: 54,
          triage_priority: 'RED' as const,
          chief_complaint: result.case.chief_complaint ?? 'SOS Panic Trigger',
          live_gps: liveGps,
          home_gps: homeGps,
          driver_gps: { lat: staging.lat, lng: staging.lng },
          hospital_name: staging.hospital,
          distance_km: distanceKm,
          eta_minutes: etaMinutes,
          timestamp: new Date().toISOString(),
        };

        DriverController.pushAssignment(assignment, assignedFleet);

        const { DispatchAckWatchdog } = await import('../../services/DispatchAckWatchdog');
        DispatchAckWatchdog.arm({
          caseId: result.case.case_id,
          fleetId: assignedFleet,
          patientName: assignment.patient_name,
        });

        return res.status(200).json({
          success: true,
          requiresCoPay: false,
          fee: 0,
          case_id: result.case.case_id,
          fleet_id: assignedFleet,
          visits_remaining: result.remaining,
          message: 'DISPATCH AUTHORIZED',
          operator: operator?.ihs_uid ?? 'DEMO',
          assignment,
        });
      }

      if (!case_id || !patient_id) {
        return res.status(400).json({ error: 'MISSING_CASE_OR_PATIENT' });
      }

      const dispatcherId = operator?.internal_id ?? '00000000-0000-0000-0000-000000000001';
      const result = await CaseStateController.attemptDispatch(case_id, patient_id, dispatcherId);

      if (!result.success) {
        return res.status(402).json({
          requiresCoPay: true,
          fee: result.fee,
          message: 'Quota exceeded',
        });
      }

      return res.status(200).json({
        success: true,
        requiresCoPay: false,
        fee: 0,
        case_id,
        message: 'DISPATCH AUTHORIZED',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR';
      if (message.includes('MLC_STATUTORY_REDIRECT')) {
        const redirect = StateEmergencyRedirectService.kickStatutoryRedirect({
          caseId: String(req.body?.case_id || 'UNKNOWN'),
          ihsUid: String(req.body?.ihs_uid || 'UNKNOWN'),
          reason: 'DISPATCH_BLOCKED_MLC',
          actorId: readOperator(req)?.ihs_uid || 'DISPATCHER',
        });
        return res.status(451).json({
          error: 'MLC_STATUTORY_REDIRECT',
          message:
            'Medico-legal case — IHS fleet dispatch blocked. Patch to State 108 / 112 immediately.',
          statutory: redirect.tel,
          dial_hints: redirect.dial_hints,
          script: redirect.script,
        });
      }
      console.error('dispatchFleet failed', error);
      return res.status(500).json({
        error: message,
      });
    }
  }

  /**
   * POST /v1/fsm/safe-harbor-mlc
   * Global MLC override — kicks 108/112 without waiting on engine side-effects.
   */
  static async triggerSafeHarbor(req: Request, res: Response) {
    try {
      const operator = readOperator(req);
      const caseId = String(req.body?.case_id || '').trim();
      if (!caseId) {
        return res.status(400).json({ error: 'MISSING_CASE_ID' });
      }
      const actorId = operator?.ihs_uid || operator?.internal_id || 'SYSTEM';

      if (isDemoMode()) {
        const result = DemoStore.triggerSafeHarborMlc(caseId, actorId);
        return res.status(200).json({
          success: true,
          case_id: caseId,
          status: 'SAFE_HARBOR_MLC',
          statutory: result.redirect.tel,
          dial_hints: result.redirect.dial_hints,
          script: result.redirect.script,
          channels: result.redirect.channels,
          message: 'STATUTORY 108/112 REDIRECT KICKED',
        });
      }

      const result = await CaseStateController.triggerSafeHarborMlc(caseId, actorId);
      return res.status(200).json({
        success: true,
        case_id: caseId,
        status: 'SAFE_HARBOR_MLC',
        statutory: result.redirect.tel,
        dial_hints: result.redirect.dial_hints,
        script: result.redirect.script,
        channels: result.redirect.channels,
        message: 'STATUTORY 108/112 REDIRECT KICKED',
      });
    } catch (error) {
      console.error('triggerSafeHarbor failed', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  /**
   * POST /v1/fsm/mlc-screening
   * Pre-dispatch MLC matrix YES → hard-lock fleet + immediate 108/112 redirect payload.
   * Does not await webhook/SMS completion.
   */
  static async mlcScreeningRedirect(req: Request, res: Response) {
    try {
      const operator = readOperator(req);
      const {
        case_id,
        ihs_uid,
        patient_name,
        chief_complaint,
        live_gps,
        create_case,
      } = req.body as {
        case_id?: string;
        ihs_uid?: string;
        patient_name?: string;
        chief_complaint?: string;
        live_gps?: { lat: number; lng: number };
        create_case?: boolean;
      };

      let caseId = case_id;
      let redirect = null as ReturnType<
        typeof StateEmergencyRedirectService.kickStatutoryRedirect
      > | null;

      if (isDemoMode() && !caseId && (create_case || ihs_uid)) {
        const patient =
          (ihs_uid && DemoStore.findPatientByUid(String(ihs_uid).toUpperCase())) ||
          DemoStore.findPatientByUid('IHS-ADMIN-00001');
        if (patient) {
          // Force MLC complaint so createPanicCase auto-kicks 108/112 once
          const created = DemoStore.createPanicCase(patient.internal_id, {
            chief_complaint: chief_complaint || 'MLC screening — assault / RTA / poisoning',
            live_lat: live_gps?.lat,
            live_lng: live_gps?.lng,
          });
          caseId = created.case_id;
          if (!created.is_mlc) {
            redirect = DemoStore.triggerSafeHarborMlc(
              created.case_id,
              operator?.ihs_uid || 'DISPATCHER',
            ).redirect;
          } else {
            // Already kicked inside createPanicCase — return dial payload without re-SMS
            redirect = {
              kicked: true as const,
              channels: { webhook_108: 'skipped' as const, sms_112: 'skipped' as const },
              dial_hints: ['tel:108', 'tel:112'],
              tel: { primary: '108', secondary: '112' },
              script:
                'Sir/Madam, based on your symptoms, we are required by law to transfer this call to the State 108 / 112 Emergency Service. Please stay on the line — I am patching you through now.',
            };
          }
        }
      } else if (isDemoMode() && caseId) {
        redirect = DemoStore.triggerSafeHarborMlc(
          caseId,
          operator?.ihs_uid || 'DISPATCHER',
        ).redirect;
      } else if (caseId) {
        redirect = (
          await CaseStateController.triggerSafeHarborMlc(
            caseId,
            operator?.ihs_uid || 'DISPATCHER',
          )
        ).redirect;
      }

      if (!redirect) {
        redirect = StateEmergencyRedirectService.kickStatutoryRedirect({
          caseId: caseId || `screen-${Date.now()}`,
          ihsUid: ihs_uid || 'UNKNOWN',
          patientName: patient_name,
          chiefComplaint: chief_complaint || 'MLC screening positive',
          liveGps: live_gps,
          actorId: operator?.ihs_uid || 'DISPATCHER',
          reason: 'PRE_DISPATCH_MLC_SCREENING',
        });
      }

      return res.status(200).json({
        success: true,
        fleet_dispatch_blocked: true,
        case_id: caseId,
        statutory: redirect.tel,
        dial_hints: redirect.dial_hints,
        script: redirect.script,
        channels: redirect.channels,
        message: 'MLC PROTOCOL — PATCH TO 108/112 NOW',
      });
    } catch (error) {
      console.error('mlcScreeningRedirect failed', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}
