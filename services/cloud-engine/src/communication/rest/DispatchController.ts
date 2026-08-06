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
      console.error('dispatchFleet failed', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}
