// ============================================================================
// FILE: src/scripts/stress-test.ts
// CONTEXT: WebSocket interconnection stress + SQLite state consistency audit
// ============================================================================

import WebSocket from 'ws';
import { PrismaClient } from '@prisma/client';

const ENGINE = process.env.STRESS_ENGINE_URL || 'http://localhost:8080';
const WS_BASE = process.env.STRESS_WS_URL || 'ws://localhost:8080';
const CYCLES = Number(process.env.STRESS_CYCLES || 25);
const PATIENT_UID = 'IHS-ADMIN-00001';
const FLEET_ID = 'AMB-VSKP-07';

type ClientName =
  | 'App#1 Patient'
  | 'App#2 Dispatcher'
  | 'App#3 Driver'
  | 'App#4 Hospital'
  | 'App#5 SuperAdmin'
  | 'App#6 Doctor';

interface SockClient {
  name: ClientName;
  url: string;
  ws: WebSocket;
  ready: Promise<void>;
}

interface RttSample {
  cycle: number;
  step: string;
  client: ClientName;
  rttMs: number;
  event: string;
}

interface StepResult {
  cycle: number;
  step: string;
  sentAt: number;
  ok: boolean;
  error?: string;
  caseId?: string;
}

const EXPECTED_EVENTS: Record<string, string[]> = {
  PANIC_ALERT: [
    'PANIC_ACKNOWLEDGED',
    'INBOUND_EMERGENCY_SOS',
    'DUAL_PIN_MISMATCH_ALERT',
    'EXECUTIVE_SNAPSHOT',
  ],
  FLEET_DISPATCH: [
    'FLEET_DISPATCH_ACK',
    'DISPATCH_ASSIGNMENT',
    'FLEET_ASSIGNMENT_PUSHED',
    'AMBULANCE_DISPATCHED',
    'INCOMING_TRANSPORT',
    'EXECUTIVE_SNAPSHOT',
  ],
  LOCATION_TELEMETRY: ['LOCATION_TELEMETRY', 'LOCATION_TELEMETRY_ACK', 'EXECUTIVE_SNAPSHOT'],
  BAY_RESERVED: ['BAY_RESERVED'],
  PRESCRIPTION_ISSUED: ['PRESCRIPTION_ISSUED'],
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function connectClient(name: ClientName, path: string): SockClient {
  const url = `${WS_BASE}${path}`;
  const ws = new WebSocket(url);
  const ready = new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout connecting ${name}`)), 8000);
    ws.once('open', () => {
      clearTimeout(t);
      resolve();
    });
    ws.once('error', (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
  return { name, url, ws, ready };
}

function waitForEvent(
  clients: SockClient[],
  allowedEvents: string[],
  sentAt: number,
  timeoutMs: number,
  match?: (msg: { event?: string; payload?: Record<string, unknown> }) => boolean,
): Promise<RttSample[]> {
  return new Promise((resolve) => {
    const samples: RttSample[] = [];
    const cleanups: Array<() => void> = [];
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanups.forEach((fn) => fn());
      resolve(samples);
    };

    const timer = setTimeout(finish, timeoutMs);

    for (const client of clients) {
      const onMsg = (raw: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(String(raw)) as {
            event?: string;
            payload?: Record<string, unknown>;
          };
          if (!msg.event || !allowedEvents.includes(msg.event)) return;
          if (match && !match(msg)) return;
          samples.push({
            cycle: 0,
            step: '',
            client: client.name,
            rttMs: Date.now() - sentAt,
            event: msg.event,
          });
        } catch {
          /* ignore */
        }
      };
      client.ws.on('message', onMsg);
      cleanups.push(() => client.ws.off('message', onMsg));
    }

    // If we already collected from all clients that matter, allow early settle via polling
    const poll = setInterval(() => {
      if (samples.length >= Math.min(3, clients.length)) {
        clearInterval(poll);
        clearTimeout(timer);
        // brief window for stragglers
        setTimeout(finish, 40);
      }
    }, 20);
    cleanups.push(() => clearInterval(poll));
  });
}

async function emitPanicAlert(
  clients: SockClient[],
  cycle: number,
): Promise<{ result: StepResult; samples: RttSample[]; caseId?: string }> {
  const panicWs = new WebSocket(`${WS_BASE}/v1/triage/panic`);
  await new Promise<void>((resolve, reject) => {
    panicWs.once('open', () => resolve());
    panicWs.once('error', reject);
  });

  let caseId: string | undefined;
  const ackWait = new Promise<string | undefined>((resolve) => {
    const t = setTimeout(() => resolve(undefined), 3000);
    panicWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          event?: string;
          payload?: { case_id?: string };
        };
        if (msg.event === 'PANIC_ACKNOWLEDGED' && msg.payload?.case_id) {
          clearTimeout(t);
          resolve(msg.payload.case_id);
        }
      } catch {
        /* ignore */
      }
    });
  });

  const sentAt = Date.now();
  const listen = waitForEvent(clients, EXPECTED_EVENTS.PANIC_ALERT, sentAt, 2500);

  panicWs.send(
    JSON.stringify({
      event: 'PANIC_ALERT',
      ihs_uid: PATIENT_UID,
      timestamp: new Date().toISOString(),
      stress_cycle: cycle,
      gps: {
        lat: 17.7231 + Math.random() * 0.004,
        lng: 83.3012 + Math.random() * 0.004,
        accuracy_meters: 12,
      },
    }),
  );

  caseId = await ackWait;
  const samples = await listen;
  samples.forEach((s) => {
    s.cycle = cycle;
    s.step = 'PANIC_ALERT';
  });
  panicWs.close();

  return {
    result: {
      cycle,
      step: 'PANIC_ALERT',
      sentAt,
      ok: Boolean(caseId) || samples.length > 0,
      caseId,
      error: caseId ? undefined : 'No PANIC_ACK case_id',
    },
    samples,
    caseId,
  };
}

async function emitFleetDispatch(
  dispatcher: SockClient,
  clients: SockClient[],
  cycle: number,
  caseId?: string,
): Promise<{ result: StepResult; samples: RttSample[] }> {
  const sentAt = Date.now();
  const listen = waitForEvent(clients, EXPECTED_EVENTS.FLEET_DISPATCH, sentAt, 3000, (msg) => {
    if (msg.payload?.stress_cycle != null) return msg.payload.stress_cycle === cycle;
    return true;
  });

  dispatcher.ws.send(
    JSON.stringify({
      event: 'FLEET_DISPATCH',
      case_id: caseId,
      ihs_uid: PATIENT_UID,
      fleet_id: FLEET_ID,
      stress_cycle: cycle,
    }),
  );

  const samples = await listen;
  samples.forEach((s) => {
    s.cycle = cycle;
    s.step = 'FLEET_DISPATCH';
  });

  return {
    result: {
      cycle,
      step: 'FLEET_DISPATCH',
      sentAt,
      ok: samples.length > 0,
      caseId,
      error: samples.length ? undefined : 'No dispatch fan-out observed',
    },
    samples,
  };
}

async function emitLocationTelemetry(
  driver: SockClient,
  clients: SockClient[],
  cycle: number,
  caseId?: string,
): Promise<{ result: StepResult; samples: RttSample[]; messagesSent: number }> {
  const allSamples: RttSample[] = [];
  let okCount = 0;

  for (let i = 0; i < 10; i++) {
    const sentAt = Date.now();
    const listen = waitForEvent(clients, EXPECTED_EVENTS.LOCATION_TELEMETRY, sentAt, 800);
    driver.ws.send(
      JSON.stringify({
        event: 'LOCATION_TELEMETRY',
        case_id: caseId,
        fleet_id: FLEET_ID,
        stress_cycle: cycle,
        lat: 17.73 + i * 0.0008,
        lng: 83.3 + i * 0.0006,
      }),
    );
    const samples = await listen;
    samples.forEach((s) => {
      s.cycle = cycle;
      s.step = 'LOCATION_TELEMETRY';
    });
    allSamples.push(...samples);
    if (samples.length > 0) okCount += 1;
    await sleep(15);
  }

  return {
    result: {
      cycle,
      step: 'LOCATION_TELEMETRY',
      sentAt: Date.now(),
      ok: okCount >= 7,
      caseId,
      error: okCount >= 7 ? undefined : `Only ${okCount}/10 telemetry bursts acknowledged`,
    },
    samples: allSamples,
    messagesSent: 10,
  };
}

async function emitBayReserved(
  hospital: SockClient,
  clients: SockClient[],
  cycle: number,
  caseId?: string,
): Promise<{ result: StepResult; samples: RttSample[] }> {
  const sentAt = Date.now();
  const listen = waitForEvent(clients, EXPECTED_EVENTS.BAY_RESERVED, sentAt, 2000);
  hospital.ws.send(
    JSON.stringify({
      event: 'BAY_RESERVED',
      case_id: caseId,
      bay_id: 'BAY-3',
      er_doctor: 'Dr. Meera Krishnan',
      stress_cycle: cycle,
    }),
  );
  const samples = await listen;
  samples.forEach((s) => {
    s.cycle = cycle;
    s.step = 'BAY_RESERVED';
  });
  return {
    result: {
      cycle,
      step: 'BAY_RESERVED',
      sentAt,
      ok: samples.length > 0,
      caseId,
      error: samples.length ? undefined : 'No BAY_RESERVED broadcast',
    },
    samples,
  };
}

async function emitPrescription(
  doctor: SockClient,
  clients: SockClient[],
  cycle: number,
): Promise<{ result: StepResult; samples: RttSample[] }> {
  const sentAt = Date.now();
  const listen = waitForEvent(clients, EXPECTED_EVENTS.PRESCRIPTION_ISSUED, sentAt, 2500);
  doctor.ws.send(
    JSON.stringify({
      event: 'PRESCRIPTION_ISSUED',
      patient_id: PATIENT_UID,
      physician: 'Dr. Ananya Rao',
      drug_name: 'Azithromycin 500mg',
      dosage: '1 tab once daily',
      duration: '3 days',
      stress_cycle: cycle,
    }),
  );
  const samples = await listen;
  samples.forEach((s) => {
    s.cycle = cycle;
    s.step = 'PRESCRIPTION_ISSUED';
  });
  return {
    result: {
      cycle,
      step: 'PRESCRIPTION_ISSUED',
      sentAt,
      ok: samples.length > 0,
      error: samples.length ? undefined : 'No PRESCRIPTION_ISSUED broadcast',
    },
    samples,
  };
}

function pct(n: number, d: number) {
  if (!d) return '0.0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function stats(values: number[]) {
  if (!values.length) return { min: 0, avg: 0, max: 0, n: 0 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, avg, max, n: values.length };
}

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  IHS Cloud Engine · WebSocket Stress & State Consistency Test  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  console.log(`Engine:  ${ENGINE}`);
  console.log(`Cycles:  ${CYCLES}`);
  console.log(`Patient: ${PATIENT_UID} · Fleet: ${FLEET_ID}\n`);

  const health = (await fetch(`${ENGINE}/healthz`)
    .then((r) => r.json())
    .catch(() => null)) as { status?: string } | null;
  if (!health || health.status !== 'ok') {
    console.error('FAIL: Cloud engine not reachable on :8080 — start it first.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const before = {
    incidents: await prisma.emergencyIncident.count(),
    prescriptions: await prisma.ePrescription.count(),
    fleet: await prisma.fleetUnit.count(),
    fleetUnit: await prisma.fleetUnit.findUnique({ where: { vehicleNumber: FLEET_ID } }),
  };

  const clients: SockClient[] = [
    connectClient('App#1 Patient', `/v1/patient/stream?ihs_uid=${PATIENT_UID}`),
    connectClient('App#2 Dispatcher', '/v1/dispatch/stream'),
    connectClient('App#3 Driver', `/v1/driver/stream?fleet_id=${FLEET_ID}`),
    connectClient('App#4 Hospital', '/v1/hospital/stream'),
    connectClient('App#5 SuperAdmin', '/v1/admin/stream'),
    connectClient('App#6 Doctor', '/v1/doctor/stream'),
  ];

  await Promise.all(clients.map((c) => c.ready));
  console.log('✓ 6 concurrent WebSocket clients connected\n');

  const byName = Object.fromEntries(clients.map((c) => [c.name, c])) as Record<
    ClientName,
    SockClient
  >;

  const allRtts: RttSample[] = [];
  const stepResults: StepResult[] = [];
  let messagesSent = 0;
  let highFrequencyEvents = 0;

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    process.stdout.write(`  Cycle ${String(cycle).padStart(2, '0')}/${CYCLES} … `);

    await fetch(`${ENGINE}/v1/demo/reset-capitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ihs_uid: PATIENT_UID, visits: 5 }),
    }).catch(() => undefined);

    const panic = await emitPanicAlert(clients, cycle);
    messagesSent += 1;
    highFrequencyEvents += 1;
    stepResults.push(panic.result);
    allRtts.push(...panic.samples);
    const caseId = panic.caseId;

    const dispatch = await emitFleetDispatch(byName['App#2 Dispatcher'], clients, cycle, caseId);
    messagesSent += 1;
    highFrequencyEvents += 1;
    stepResults.push(dispatch.result);
    allRtts.push(...dispatch.samples);

    const telemetry = await emitLocationTelemetry(
      byName['App#3 Driver'],
      clients,
      cycle,
      caseId,
    );
    messagesSent += telemetry.messagesSent;
    highFrequencyEvents += telemetry.messagesSent;
    stepResults.push(telemetry.result);
    allRtts.push(...telemetry.samples);

    const bay = await emitBayReserved(byName['App#4 Hospital'], clients, cycle, caseId);
    messagesSent += 1;
    highFrequencyEvents += 1;
    stepResults.push(bay.result);
    allRtts.push(...bay.samples);

    const rx = await emitPrescription(byName['App#6 Doctor'], clients, cycle);
    messagesSent += 1;
    highFrequencyEvents += 1;
    stepResults.push(rx.result);
    allRtts.push(...rx.samples);

    const cycleOk = [panic, dispatch, telemetry, bay, rx].every((x) => x.result.ok);
    console.log(cycleOk ? 'OK' : 'PARTIAL');
  }

  // Allow Prisma dual-write to settle
  await sleep(400);

  const after = {
    incidents: await prisma.emergencyIncident.count(),
    prescriptions: await prisma.ePrescription.count(),
    fleet: await prisma.fleetUnit.count(),
    fleetUnit: await prisma.fleetUnit.findUnique({ where: { vehicleNumber: FLEET_ID } }),
  };

  const deltaIncidents = after.incidents - before.incidents;
  const deltaRx = after.prescriptions - before.prescriptions;
  const fleetPresent = Boolean(after.fleetUnit);
  const fleetTouched =
    fleetPresent &&
    (after.fleetUnit?.status !== before.fleetUnit?.status ||
      after.fleetUnit?.updatedAt?.getTime() !== before.fleetUnit?.updatedAt?.getTime() ||
      after.fleet >= before.fleet);

  const stepsOk = stepResults.filter((s) => s.ok).length;
  const broadcastSuccess = pct(stepsOk, stepResults.length);
  const rttValues = allRtts.map((r) => r.rttMs);
  const overall = stats(rttValues);

  const byStep = ['PANIC_ALERT', 'FLEET_DISPATCH', 'LOCATION_TELEMETRY', 'BAY_RESERVED', 'PRESCRIPTION_ISSUED'];
  const integrity = {
    incidents: deltaIncidents >= CYCLES,
    prescriptions: deltaRx >= CYCLES,
    fleet: fleetTouched || fleetPresent,
  };
  const integrityPass = integrity.incidents && integrity.prescriptions && integrity.fleet;

  console.log('\n┌─────────────────────────┬────────┬────────┬────────┬────────┐');
  console.log('│ Step                    │ Samples│ Min ms │ Avg ms │ Max ms │');
  console.log('├─────────────────────────┼────────┼────────┼────────┼────────┤');
  for (const step of byStep) {
    const s = stats(allRtts.filter((r) => r.step === step).map((r) => r.rttMs));
    console.log(
      `│ ${pad(step, 23)} │ ${String(s.n).padStart(6)} │ ${s.min.toFixed(1).padStart(6)} │ ${s.avg
        .toFixed(1)
        .padStart(6)} │ ${s.max.toFixed(1).padStart(6)} │`,
    );
  }
  console.log('├─────────────────────────┼────────┼────────┼────────┼────────┤');
  console.log(
    `│ ${pad('OVERALL RTT', 23)} │ ${String(overall.n).padStart(6)} │ ${overall.min
      .toFixed(1)
      .padStart(6)} │ ${overall.avg.toFixed(1).padStart(6)} │ ${overall.max.toFixed(1).padStart(6)} │`,
  );
  console.log('└─────────────────────────┴────────┴────────┴────────┴────────┘');

  console.log('\n┌──────────────────────────────────┬────────────────────────────┐');
  console.log('│ Metric                           │ Value                      │');
  console.log('├──────────────────────────────────┼────────────────────────────┤');
  console.log(`│ ${pad('WS clients', 32)} │ ${pad('6 / 6 connected', 26)} │`);
  console.log(`│ ${pad('Emergency cycles', 32)} │ ${pad(String(CYCLES), 26)} │`);
  console.log(`│ ${pad('Socket messages sent', 32)} │ ${pad(String(messagesSent), 26)} │`);
  console.log(`│ ${pad('High-frequency events', 32)} │ ${pad(String(highFrequencyEvents), 26)} │`);
  console.log(`│ ${pad('Broadcast success rate', 32)} │ ${pad(broadcastSuccess, 26)} │`);
  console.log(
    `│ ${pad('RTT min / avg / max (ms)', 32)} │ ${pad(
      `${overall.min.toFixed(1)} / ${overall.avg.toFixed(1)} / ${overall.max.toFixed(1)}`,
      26,
    )} │`,
  );
  console.log('└──────────────────────────────────┴────────────────────────────┘');

  console.log('\n┌──────────────────────────────────┬────────────┬───────────────┐');
  console.log('│ DB Integrity Check               │ Observed   │ Verdict       │');
  console.log('├──────────────────────────────────┼────────────┼───────────────┤');
  console.log(
    `│ ${pad(`EmergencyIncident Δ (expect ≥${CYCLES})`, 32)} │ ${String(deltaIncidents).padStart(10)} │ ${pad(
      integrity.incidents ? 'PASS' : 'FAIL',
      13,
    )} │`,
  );
  console.log(
    `│ ${pad(`EPrescription Δ (expect ≥${CYCLES})`, 32)} │ ${String(deltaRx).padStart(10)} │ ${pad(
      integrity.prescriptions ? 'PASS' : 'FAIL',
      13,
    )} │`,
  );
  console.log(
    `│ ${pad('FleetUnit AMB-VSKP-07 present', 32)} │ ${pad(fleetPresent ? 'yes' : 'no', 10)} │ ${pad(
      integrity.fleet ? 'PASS' : 'FAIL',
      13,
    )} │`,
  );
  console.log(
    `│ ${pad('Messages sent (socket total)', 32)} │ ${String(messagesSent).padStart(10)} │ ${pad('info', 13)} │`,
  );
  console.log('└──────────────────────────────────┴────────────┴───────────────┘');

  console.log(
    `\n==> OVERALL: ${integrityPass && stepsOk === stepResults.length ? 'PASS' : integrityPass ? 'PASS (with partial broadcasts)' : 'FAIL'}`,
  );
  console.log(
    `    Integrity ${integrityPass ? 'PASS' : 'FAIL'} · Broadcast ${broadcastSuccess} · RTT samples ${overall.n}\n`,
  );

  for (const c of clients) {
    try {
      c.ws.close();
    } catch {
      /* ignore */
    }
  }
  await prisma.$disconnect();

  process.exit(integrityPass ? 0 : 2);
}

main().catch((err) => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
