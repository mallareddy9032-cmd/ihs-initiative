// ============================================================================
// FILE: src/communication/websockets/WebSocketEngine.ts
// CONTEXT: IHS Cloud Engine - Shared WebSocket Broadcast Hub
// ============================================================================

import { WebSocket } from 'ws';

const dispatcherClients = new Set<WebSocket>();
/** fleet_id → driver sockets (empty string key = listen-all) */
const driverClients = new Map<string, Set<WebSocket>>();
/** case_id → patient / tracker sockets */
const caseTrackClients = new Map<string, Set<WebSocket>>();
/** Hospital ER receiving consoles */
const hospitalClients = new Set<WebSocket>();
/** Executive / SuperAdmin telemetry consoles */
const adminClients = new Set<WebSocket>();
/** Doctor / clinician consoles */
const doctorClients = new Set<WebSocket>();
/** Patient app sockets keyed by ihs_uid */
const patientClients = new Map<string, Set<WebSocket>>();

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function addToBucket(map: Map<string, Set<WebSocket>>, key: string, ws: WebSocket): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(ws);
}

function removeFromBucket(map: Map<string, Set<WebSocket>>, key: string, ws: WebSocket): void {
  const set = map.get(key);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) map.delete(key);
}

function fanout(set: Set<WebSocket>, data: unknown): void {
  const messageStr = JSON.stringify(data);
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

export class WebSocketEngine {
  static registerDispatcher(ws: WebSocket): void {
    dispatcherClients.add(ws);
    ws.on('close', () => dispatcherClients.delete(ws));
    ws.on('error', () => dispatcherClients.delete(ws));
  }

  static broadcastToDispatchers(data: unknown): void {
    fanout(dispatcherClients, data);
    // Mirror operational traffic to SuperAdmin (once)
    fanout(adminClients, data);
  }

  static dispatcherCount(): number {
    return dispatcherClients.size;
  }

  static registerDriver(ws: WebSocket, fleetId: string): void {
    const key = fleetId.toUpperCase() || '*';
    addToBucket(driverClients, key, ws);
    if (key !== '*') {
      addToBucket(driverClients, '*', ws);
    }
    const cleanup = () => {
      removeFromBucket(driverClients, key, ws);
      if (key !== '*') removeFromBucket(driverClients, '*', ws);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  }

  static broadcastToDrivers(data: unknown, fleetId?: string): void {
    const targets = new Set<WebSocket>();
    if (fleetId) {
      driverClients.get(fleetId.toUpperCase())?.forEach((ws) => targets.add(ws));
    } else {
      driverClients.get('*')?.forEach((ws) => targets.add(ws));
    }
    targets.forEach((ws) => sendJson(ws, data));
  }

  static driverCount(): number {
    let n = 0;
    driverClients.get('*')?.forEach(() => {
      n += 1;
    });
    return n;
  }

  static registerCaseTracker(ws: WebSocket, caseId: string): void {
    const key = caseId;
    addToBucket(caseTrackClients, key, ws);
    const cleanup = () => removeFromBucket(caseTrackClients, key, ws);
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  }

  static broadcastToCase(caseId: string, data: unknown): void {
    caseTrackClients.get(caseId)?.forEach((ws) => sendJson(ws, data));
  }

  static broadcast(caseId: string, data: unknown): void {
    WebSocketEngine.broadcastToDispatchers({
      case_id: caseId,
      ...(typeof data === 'object' && data !== null ? data : { payload: data }),
    });
    WebSocketEngine.broadcastToCase(caseId, data);
  }

  static registerHospital(ws: WebSocket): void {
    hospitalClients.add(ws);
    ws.on('close', () => hospitalClients.delete(ws));
    ws.on('error', () => hospitalClients.delete(ws));
  }

  static broadcastToHospitals(data: unknown): void {
    fanout(hospitalClients, data);
    fanout(adminClients, data);
  }

  static hospitalCount(): number {
    return hospitalClients.size;
  }

  static registerAdmin(ws: WebSocket): void {
    adminClients.add(ws);
    ws.on('close', () => adminClients.delete(ws));
    ws.on('error', () => adminClients.delete(ws));
  }

  static broadcastToAdmins(data: unknown): void {
    fanout(adminClients, data);
  }

  static adminCount(): number {
    return adminClients.size;
  }

  static registerDoctor(ws: WebSocket): void {
    doctorClients.add(ws);
    ws.on('close', () => doctorClients.delete(ws));
    ws.on('error', () => doctorClients.delete(ws));
  }

  static broadcastToDoctors(data: unknown): void {
    fanout(doctorClients, data);
  }

  static doctorCount(): number {
    return doctorClients.size;
  }

  static registerPatient(ws: WebSocket, ihsUid: string): void {
    const key = ihsUid.toUpperCase();
    addToBucket(patientClients, key, ws);
    const cleanup = () => removeFromBucket(patientClients, key, ws);
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  }

  static broadcastToPatient(ihsUid: string, data: unknown): void {
    patientClients.get(ihsUid.toUpperCase())?.forEach((ws) => sendJson(ws, data));
  }

  /** Fan-out to dispatcher + hospitals + drivers + case + admin (admin once). */
  static broadcastEverywhere(
    data: unknown,
    opts?: { caseId?: string; fleetId?: string },
  ): void {
    fanout(dispatcherClients, data);
    fanout(hospitalClients, data);
    fanout(adminClients, data);
    if (opts?.fleetId) {
      WebSocketEngine.broadcastToDrivers(data, opts.fleetId);
    } else {
      WebSocketEngine.broadcastToDrivers(data);
    }
    if (opts?.caseId) {
      WebSocketEngine.broadcastToCase(opts.caseId, data);
    }
  }
}
