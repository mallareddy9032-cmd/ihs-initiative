// ============================================================================
// FILE: src/services/StateEmergencyRedirectService.ts
// CONTEXT: Statutory 108/112 MLC redirects — fire-and-forget, never block FSM/dispatch
// ============================================================================

import { SmsService } from './sms.service';

export const STATUTORY_108 = '108';
export const STATUTORY_112 = '112';

/** Hard ceiling for outbound statutory HTTP — never stall the engine. */
const WEBHOOK_TIMEOUT_MS = 2500;

export interface MlcRedirectInput {
  caseId: string;
  ihsUid: string;
  reason?: string;
  actorId?: string;
  liveGps?: { lat: number; lng: number };
  chiefComplaint?: string;
  patientName?: string;
}

export interface MlcRedirectResult {
  kicked: true;
  channels: {
    webhook_108: 'queued' | 'skipped';
    sms_112: 'queued' | 'skipped';
  };
  dial_hints: string[];
  tel: { primary: string; secondary: string };
  script: string;
}

const MLC_SCRIPT =
  'Sir/Madam, based on your symptoms, we are required by law to transfer this call to the State 108 / 112 Emergency Service. Please stay on the line — I am patching you through now.';

/**
 * Detect MLC-class complaints that must default to statutory 108/112
 * rather than IHS ALS fleet dispatch.
 */
export function isMlcComplaint(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  const patterns = [
    /\bmlc\b/,
    /medico[\s-]?legal/,
    /assault/,
    /gunshot|firearm|bullet/,
    /stab(bing|bed)?/,
    /poison(ing|ed)?/,
    /suicid(e|al)/,
    /hanging/,
    /rape|sexual assault/,
    /rta\b|road traffic|hit[\s-]?and[\s-]?run/,
    /unconscious.*(accident|rta|crash)/,
    /accident.*unconscious/,
  ];
  return patterns.some((re) => re.test(t));
}

export class StateEmergencyRedirectService {
  /**
   * Kick statutory 108/112 redirects immediately and return without waiting
   * on webhook/SMS completion. Callers must not await side-effect latency.
   */
  static kickStatutoryRedirect(input: MlcRedirectInput): MlcRedirectResult {
    const dial108 = process.env.STATE_108_DIAL || STATUTORY_108;
    const dial112 = process.env.STATE_112_DIAL || STATUTORY_112;
    const webhookUrl = process.env.STATE_108_WEBHOOK_URL?.trim();
    const sms112To = process.env.STATE_112_SMS_TO?.trim() || process.env.DEMO_ALERT_PHONE?.trim();

    const dialHints = [`tel:${dial108}`, `tel:${dial112}`];

    // Fire-and-forget — do not return a Promise the FSM awaits.
    if (webhookUrl) {
      void StateEmergencyRedirectService.post108Webhook(webhookUrl, input).catch((err) => {
        console.warn('[MLC:108] webhook failed (non-blocking)', err);
      });
    } else {
      console.log(
        `[MLC:108:IMMEDIATE] case=${input.caseId} uid=${input.ihsUid} ` +
          `reason=${input.reason || 'SAFE_HARBOR'} → dial ${dial108}/${dial112} (no STATE_108_WEBHOOK_URL)`,
      );
    }

    if (sms112To) {
      void SmsService.sendSms(
        sms112To,
        `STATUTORY MLC REDIRECT 108/112 · case ${input.caseId} · ${input.ihsUid}` +
          (input.patientName ? ` · ${input.patientName}` : '') +
          (input.chiefComplaint ? ` · ${input.chiefComplaint}` : '') +
          (input.liveGps
            ? ` · GPS ${input.liveGps.lat.toFixed(5)},${input.liveGps.lng.toFixed(5)}`
            : '') +
          ` · Patch to ${dial108}/${dial112} NOW`,
      ).catch((err) => console.warn('[MLC:112] SMS failed (non-blocking)', err));
    }

    return {
      kicked: true,
      channels: {
        webhook_108: webhookUrl ? 'queued' : 'skipped',
        sms_112: sms112To ? 'queued' : 'skipped',
      },
      dial_hints: dialHints,
      tel: { primary: dial108, secondary: dial112 },
      script: MLC_SCRIPT,
    };
  }

  private static async post108Webhook(url: string, input: MlcRedirectInput): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-IHS-MLC': '1' },
        signal: controller.signal,
        body: JSON.stringify({
          event: 'STATE_108_MLC_HANDOFF',
          case_id: input.caseId,
          ihs_uid: input.ihsUid,
          reason: input.reason || 'SAFE_HARBOR_MLC',
          actor_id: input.actorId,
          chief_complaint: input.chiefComplaint,
          patient_name: input.patientName,
          live_gps: input.liveGps,
          statutory: { primary: STATUTORY_108, secondary: STATUTORY_112 },
          timestamp: new Date().toISOString(),
        }),
      });
      console.log(`[MLC:108] webhook status=${res.status} case=${input.caseId}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
