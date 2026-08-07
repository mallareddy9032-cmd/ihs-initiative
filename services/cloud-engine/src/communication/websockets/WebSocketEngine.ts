// ============================================================================
// FILE: src/communication/websockets/WebSocketEngine.ts
// CONTEXT: IHS Cloud Engine - Shared WebSocket Broadcast Hub
// ============================================================================

import { WebSocket } from 'ws';

/** Keepalive interval — prevents idle proxy / LB drops (~60s typical). */
export const WS_HEARTBEAT_MS = 15_000;

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

type HeartbeatSocket = WebSocket & { isAlive?: boolean; __ihsHeartbeat?: boolean };

function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Protocol ping/pong (server → client) + application PING/PONG (browser clients).
 * Call once per accepted socket.
 */
function attachHeartbeat(ws: WebSocket): void {
  const sock = ws as HeartbeatSocket;
  if (sock.__ihsHeartbeat) return;
  sock.__ihsHeartbeat = true;
  sock.isAlive = true;

  sock.on('pong', () => {
    sock.isAlive = true;
  });

  sock.on('message', (raw) => {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const msg = JSON.parse(text) as { event?: string; type?: string };
      if (msg?.event === 'PING' || msg?.type === 'ping') {
        sendJson(sock, { event: 'PONG', timestamp: Date.now() });
      }
    } catch {
      /* binary / non-JSON frames ignored */
    }
  });

  const interval = setInterval(() => {
    if (sock.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }
    if (sock.isAlive === false) {
      clearInterval(interval);
      sock.terminate();
      return;
    }
    sock.isAlive = false;
    try {
      sock.ping();
    } catch {
      clearInterval(interval);
      sock.terminate();
    }
  }, WS_HEARTBEAT_MS);

  const stop = () => clearInterval(interval);
  sock.on('close', stop);
  sock.on('error', stop);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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
    attachHeartbeat(ws);
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

  /** Attach 15s keepalive to sockets that skip register* (e.g. panic ingress). */
  static attachSocketHeartbeat(ws: WebSocket): void {
    attachHeartbeat(ws);
  }
}
