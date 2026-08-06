// ============================================================================
// FILE: src/services/EmergencyTriggerEngine.ts
// CONTEXT: Network Resiliency & State Machine
// ============================================================================

import { NativeModules, Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const { DirectSmsModule } = NativeModules;

const COMMAND_CENTER_SHORTCODE = '+919876543210'; // Placeholder for IHS GSM Modem
const DEFAULT_WSS_URL = 'ws://localhost:8080/v1/triage/panic';

export type PanicGps = { lat: number; lng: number };

export interface PanicPayload {
  event: 'PANIC_TRIGGERED';
  ihs_uid: string;
  timestamp: string;
  gps: PanicGps;
  connection_type?: string;
}

type DirectSmsNativeModule = {
  sendDirectSms: (phoneNumber: string, message: string) => Promise<string>;
};

export class EmergencyTriggerEngine {
  private ihsUid: string;
  private encryptionKey: string;
  private wssUrl: string;

  constructor(ihsUid: string, encryptionKey: string, wssUrl: string = DEFAULT_WSS_URL) {
    this.ihsUid = ihsUid;
    this.encryptionKey = encryptionKey;
    this.wssUrl = wssUrl;
  }

  public async firePanic(gps: PanicGps): Promise<string> {
    if (!this.ihsUid) {
      throw new Error('CRITICAL: Missing ihs_uid for panic dispatch.');
    }
    if (typeof gps?.lat !== 'number' || typeof gps?.lng !== 'number') {
      throw new Error('CRITICAL: Invalid GPS coordinates for panic dispatch.');
    }

    const payload: PanicPayload = {
      event: 'PANIC_TRIGGERED',
      ihs_uid: this.ihsUid,
      timestamp: new Date().toISOString(),
      gps,
      connection_type: 'WIFI_LTE',
    };

    const attemptWss = async (): Promise<void> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let activeSocket: WebSocket | undefined;
      try {
        // Race the WebSocket connection against a 1500ms strict timeout
        await Promise.race([
          this.transmitOverWss(payload, (ws) => {
            activeSocket = ws;
          }),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 1500);
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        try {
          activeSocket?.close();
        } catch {
          // ignore
        }
      }
    };

    try {
      await attemptWss();
      return 'DISPATCHED_VIA_WSS';
    } catch (firstError) {
      // One reconnect attempt before SMS / local fallback
      console.warn('WSS panic attempt failed — retrying once.', firstError);
      try {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 350);
        });
        await attemptWss();
        return 'DISPATCHED_VIA_WSS';
      } catch (secondError) {
        console.warn('WSS Failed after retry. Executing SMS Fallback.', secondError);
        await this.executeSmsFallback(payload);
        return 'DISPATCHED_VIA_SMS';
      }
    }
  }

  private transmitOverWss(
    payload: PanicPayload,
    onSocket?: (ws: WebSocket) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let ws: WebSocket;

      try {
        ws = new WebSocket(this.wssUrl);
        onSocket?.(ws);
      } catch (error) {
        reject(error);
        return;
      }

      const settle = (fn: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify(payload));
          ws.close();
          settle(() => resolve());
        } catch (error) {
          settle(() => reject(error));
        }
      };

      ws.onerror = (e) => {
        settle(() => reject(e));
      };

      ws.onclose = (event) => {
        if (!settled) {
          settle(() => reject(new Error(`WSS_CLOSED_${event.code}`)));
        }
      };
    });
  }

  private async executeSmsFallback(payload: PanicPayload): Promise<void> {
    // Minify keys to save SMS character space
    const minified = {
      e: 'SOS',
      i: payload.ihs_uid,
      t: payload.timestamp,
      g: `${payload.gps.lat},${payload.gps.lng}`,
    };

    const stringified = JSON.stringify(minified);
    const encrypted = CryptoJS.AES.encrypt(stringified, this.encryptionKey).toString();
    const smsBody = `IHS::${encrypted}`;

    const smsBridge = DirectSmsModule as DirectSmsNativeModule | undefined;
    if (!smsBridge?.sendDirectSms) {
      if (Platform.OS === 'ios' || Platform.OS === 'web') {
        throw new Error(
          Platform.OS === 'web'
            ? 'SMS_FALLBACK_UNSUPPORTED_WEB: Connect to Cloud Engine over network, or use the Android app for offline SMS dispatch.'
            : 'SMS_FALLBACK_UNSUPPORTED_IOS: Use MessageUI compose fallback or ensure native bridge is linked.',
        );
      }
      throw new Error('DirectSmsModule native bridge is not linked.');
    }

    // Fire Native Bridge (Format: IHS::[AES_STRING])
    await smsBridge.sendDirectSms(COMMAND_CENTER_SHORTCODE, smsBody);
  }
}
