// ============================================================================
// FILE: src/communication/websockets/AdminController.ts
// CONTEXT: SuperAdmin executive telemetry stream
// ============================================================================

import { WebSocket } from 'ws';
import { WebSocketEngine } from './WebSocketEngine';
import { ExecutiveAnalytics } from '../../infrastructure/analytics/ExecutiveAnalytics';

export class AdminController {
  static handleConnection(ws: WebSocket): void {
    WebSocketEngine.registerAdmin(ws);

    const snapshot = ExecutiveAnalytics.snapshot({
      dispatchers: WebSocketEngine.dispatcherCount(),
      drivers: WebSocketEngine.driverCount(),
      hospitals: WebSocketEngine.hospitalCount(),
      admins: WebSocketEngine.adminCount(),
    });

    ws.send(
      JSON.stringify({
        event: 'ADMIN_CONNECTED',
        payload: {
          node: 'AP-SOUTH-2',
          message: 'Executive telemetry channel open',
        },
      }),
    );
    ws.send(
      JSON.stringify({
        event: 'EXECUTIVE_SNAPSHOT',
        payload: snapshot,
      }),
    );

    console.log(`[Admin] SuperAdmin console connected · admins=${WebSocketEngine.adminCount()}`);
  }

  static pushSnapshot(): void {
    const snapshot = ExecutiveAnalytics.snapshot({
      dispatchers: WebSocketEngine.dispatcherCount(),
      drivers: WebSocketEngine.driverCount(),
      hospitals: WebSocketEngine.hospitalCount(),
      admins: WebSocketEngine.adminCount(),
    });
    WebSocketEngine.broadcastToAdmins({
      event: 'EXECUTIVE_SNAPSHOT',
      payload: snapshot,
    });
  }

  static onMirroredEvent(envelope: { event?: string; payload?: unknown }): void {
    const event = envelope.event;
    if (!event) return;

    if (event === 'INBOUND_EMERGENCY_SOS' || event === 'DUAL_PIN_MISMATCH_ALERT') {
      ExecutiveAnalytics.noteIncidentEvent('vizag');
      AdminController.pushSnapshot();
      return;
    }

    if (event === 'FLEET_ASSIGNMENT_PUSHED') {
      ExecutiveAnalytics.noteIncidentEvent('vizag');
      AdminController.pushSnapshot();
      return;
    }

    if (event === 'INCOMING_TRANSPORT' || event === 'DRIVER_STATUS_UPDATE') {
      AdminController.pushSnapshot();
      return;
    }

    if (event === 'ER_INTAKE_CONFIRMED') {
      ExecutiveAnalytics.noteErIntake();
      AdminController.pushSnapshot();
    }
  }
}
