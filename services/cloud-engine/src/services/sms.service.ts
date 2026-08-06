// ============================================================================
// FILE: src/services/sms.service.ts
// CONTEXT: Twilio SMS / voice fallback with graceful console logging
// ============================================================================

type TwilioClientLike = {
  messages: {
    create: (opts: { body: string; from: string; to: string }) => Promise<{ sid: string }>;
  };
};

let twilioClient: TwilioClientLike | null | undefined;

function getTwilioClient(): TwilioClientLike | null {
  if (twilioClient !== undefined) return twilioClient;

  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();

  if (!sid || !token || !from || sid.startsWith('AC_PLACEHOLDER') || sid.length < 10) {
    twilioClient = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio') as (accountSid: string, authToken: string) => TwilioClientLike;
    twilioClient = twilio(sid, token);
    return twilioClient;
  } catch (error) {
    console.warn('[SMS] Twilio SDK unavailable — console fallback only', error);
    twilioClient = null;
    return null;
  }
}

export class SmsService {
  static async sendSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; mode: string }> {
    const from = process.env.TWILIO_PHONE_NUMBER?.trim() || '';
    const client = getTwilioClient();

    if (!client || !from || !to) {
      console.log(`[SMS:FALLBACK] → ${to || 'NO_TO'}\n${body}`);
      return { ok: true, mode: 'console_fallback' };
    }

    try {
      const msg = await client.messages.create({ body, from, to });
      console.log(`[SMS:TWILIO] sid=${msg.sid} → ${to}`);
      return { ok: true, sid: msg.sid, mode: 'twilio' };
    } catch (error) {
      console.warn('[SMS] Twilio send failed — console fallback', error);
      console.log(`[SMS:FALLBACK] → ${to}\n${body}`);
      return { ok: false, mode: 'console_fallback_after_error' };
    }
  }

  static async sendEmergencySosAlert(input: {
    patientName: string;
    phone?: string | null;
    time?: string;
    trackUrl?: string;
  }): Promise<void> {
    const to = input.phone || process.env.TWILIO_ALERT_TO || process.env.DEMO_ALERT_PHONE || '';
    const time = input.time || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const track = input.trackUrl || 'http://localhost:3000/track';
    const body = `EMERGENCY ALERT: ${input.patientName} triggered SOS at ${time}. Live Tracking: ${track}`;
    await SmsService.sendSms(to, body);
  }

  static async sendDispatchAckFallback(input: {
    standbyPhone?: string | null;
    fleetId: string;
    caseId: string;
    patientName: string;
  }): Promise<void> {
    const to =
      input.standbyPhone ||
      process.env.TWILIO_STANDBY_DRIVER_PHONE ||
      process.env.DEMO_ALERT_PHONE ||
      '';
    const body =
      `URGENT DISPATCH FALLBACK: Primary unit ${input.fleetId} did not ACCEPT DISPATCH within 30s ` +
      `for case ${input.caseId} (${input.patientName}). Standby driver — acknowledge immediately.`;
    await SmsService.sendSms(to, body);
  }
}
