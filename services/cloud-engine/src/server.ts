// ============================================================================
// FILE: src/server.ts
// CONTEXT: IHS Cloud Engine - HTTP + WebSocket Entry Point
// ============================================================================

import './bootstrapEnv';

import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { AuthController } from './communication/rest/AuthController';
import { TelemetrySyncController } from './communication/rest/TelemetrySyncController';
import { DispatchController } from './communication/rest/DispatchController';
import { PanicController } from './communication/websockets/PanicController';
import { DriverController } from './communication/websockets/DriverController';
import { HospitalController } from './communication/websockets/HospitalController';
import { AdminController } from './communication/websockets/AdminController';
import { DoctorController } from './communication/websockets/DoctorController';
import { ClinicalController } from './communication/rest/ClinicalController';
import { FleetComplianceDaemon } from './daemons/FleetComplianceCron';
import { DataComplianceDaemon } from './daemons/GlacierMigrationCron';
import { DemoStore, isDataPlaneReady, isDemoMode } from './infrastructure/demo/DemoStore';
import { WebSocketEngine } from './communication/websockets/WebSocketEngine';
import { ExecutiveAnalytics } from './infrastructure/analytics/ExecutiveAnalytics';
import { FullChainSimulator } from './services/FullChainSimulator';

const PORT = Number(process.env.PORT || 8080);

async function bootstrap() {
  if (isDemoMode()) {
    await DemoStore.initialize();
  }

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = new Set([
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://localhost:3003',
      'http://127.0.0.1:3003',
      'http://localhost:3004',
      'http://127.0.0.1:3004',
      'http://localhost:3005',
      'http://127.0.0.1:3005',
      process.env.PUBLIC_PORTALS_ORIGIN || '',
    ]);
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    return next();
  });

  app.post('/v1/auth/login', (req, res) => AuthController.authenticateOperator(req, res));
  app.post('/v1/auth/logout', (req, res) => AuthController.destroySession(req, res));
  app.post('/v1/telemetry/sync', (req, res) => TelemetrySyncController.ingestBatch(req, res));
  app.get('/v1/billing/mobilization-check', (req, res) =>
    DispatchController.mobilizationCheck(req, res),
  );
  app.post('/v1/fsm/dispatch', (req, res) => DispatchController.dispatchFleet(req, res));

  app.get('/v1/clinical/appointments', (req, res) => ClinicalController.listAppointments(req, res));
  app.post('/v1/clinical/appointments', (req, res) => ClinicalController.queueAppointment(req, res));
  app.get('/v1/clinical/vault/:ihsUid', (req, res) => ClinicalController.getPatientVault(req, res));
  app.post('/v1/clinical/consult/start', (req, res) => ClinicalController.startConsult(req, res));
  app.post('/v1/clinical/consult/end', (req, res) => ClinicalController.endConsult(req, res));
  app.post('/v1/clinical/prescriptions', (req, res) => ClinicalController.issuePrescription(req, res));
  app.post('/v1/prescriptions/issue', (req, res) => ClinicalController.issuePrescription(req, res));

  app.post('/v1/demo/reset-capitation', (req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.body?.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
    const patient = DemoStore.findPatientByUid(ihsUid);
    if (!patient) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }
    const sub = DemoStore.findSubscription(patient.internal_id);
    if (sub) sub.doorstep_visits_remaining = Number(req.body?.visits) || 3;
    return res.status(200).json({
      success: true,
      ihs_uid: ihsUid,
      visits_remaining: sub?.doorstep_visits_remaining ?? 0,
    });
  });

  app.post('/v1/demo/inject-panic', async (req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.body?.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
    const patient = DemoStore.findPatientByUid(ihsUid);
    if (!patient) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }

    const live = req.body?.gps || {
      lat: patient.home_lat + 0.0025,
      lng: patient.home_lng + 0.0018,
    };

    const result = await PanicController.injectPanic({
      event: 'PANIC_TRIGGERED',
      ihs_uid: ihsUid,
      timestamp: new Date().toISOString(),
      gps: live,
      connection_type: 'DEMO_INJECT',
    });

    if (!result.ok) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(202).json({
      accepted: true,
      ihs_uid: ihsUid,
      message: 'Panic injected onto /v1/dispatch/stream',
    });
  });

  /** One-shot demo: create SOS case + authorize fleet → pushes DISPATCH_ASSIGNMENT to drivers */
  app.post('/v1/demo/assign-driver', async (req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.body?.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
    const fleetId = String(req.body?.fleet_id || 'AMB-VSKP-07').toUpperCase();
    const patient = DemoStore.findPatientByUid(ihsUid);
    if (!patient) {
      return res.status(404).json({ error: 'PATIENT_NOT_FOUND' });
    }

    const live = req.body?.gps || {
      lat: patient.home_lat + 0.0025,
      lng: patient.home_lng + 0.0018,
    };

    await PanicController.injectPanic({
      event: 'PANIC_TRIGGERED',
      ihs_uid: ihsUid,
      timestamp: new Date().toISOString(),
      gps: live,
      connection_type: 'DEMO_DRIVER_ASSIGN',
    });

    const clinicalCase = DemoStore.findLatestInitiatedCase(patient.internal_id);
    if (!clinicalCase) {
      return res.status(500).json({ error: 'CASE_CREATE_FAILED' });
    }

    req.body = {
      case_id: clinicalCase.case_id,
      patient_id: patient.internal_id,
      ihs_uid: ihsUid,
      fleet_id: fleetId,
    };
    return DispatchController.dispatchFleet(req, res);
  });

  app.post('/v1/hospital/reserve-bay', (req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const caseId = String(req.body?.case_id || '');
    const bayId = String(req.body?.bay_id || 'BAY-2');
    const doctor = String(req.body?.er_doctor || 'Dr. Meera Krishnan');
    if (!caseId) {
      return res.status(400).json({ error: 'MISSING_CASE_ID' });
    }
    const clinicalCase = DemoStore.reserveBay(caseId, bayId, doctor);
    if (!clinicalCase) {
      return res.status(404).json({ error: 'CASE_NOT_FOUND' });
    }
    const envelope = {
      event: 'BAY_RESERVED',
      payload: {
        case_id: caseId,
        bay_id: bayId,
        er_doctor: doctor,
        fleet_id: clinicalCase.assigned_fleet_id,
        timestamp: new Date().toISOString(),
      },
    };
    WebSocketEngine.broadcastToHospitals(envelope);
    WebSocketEngine.broadcastToDispatchers(envelope);
    return res.status(200).json({ success: true, ...envelope.payload });
  });

  app.post('/v1/hospital/er-intake', (req, res) => {
    const result = HospitalController.confirmIntake({
      case_id: String(req.body?.case_id || ''),
      bay_id: req.body?.bay_id ? String(req.body.bay_id) : undefined,
      er_doctor: req.body?.er_doctor ? String(req.body.er_doctor) : undefined,
    });
    if (!result.ok) {
      return res.status(result.error === 'CASE_NOT_FOUND' ? 404 : 400).json({ error: result.error });
    }
    return res.status(200).json({ success: true, ...result.payload });
  });

  /** Demo: assign driver + push TRANSPORTING so ER queue lights up immediately */
  app.post('/v1/demo/incoming-er', async (req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ error: 'DEMO_MODE_REQUIRED' });
    }
    const ihsUid = String(req.body?.ihs_uid || 'IHS-ADMIN-00001').toUpperCase();
    const fleetId = String(req.body?.fleet_id || 'AMB-VSKP-07').toUpperCase();

    // Chain through assign-driver
    const assignRes = await fetch(`http://127.0.0.1:${PORT}/v1/demo/assign-driver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ihs_uid: ihsUid, fleet_id: fleetId }),
    });
    const assignBody = (await assignRes.json()) as {
      case_id?: string;
      error?: string;
      assignment?: { eta_minutes?: number };
    };
    if (!assignRes.ok || !assignBody.case_id) {
      return res.status(500).json({ error: assignBody.error || 'ASSIGN_FAILED' });
    }

    DriverController.handleStatusUpdate(
      {
        event: 'DRIVER_STATUS_UPDATE',
        case_id: assignBody.case_id,
        fleet_id: fleetId,
        status: 'TRANSPORTING',
        label: 'TRANSPORTING TO HOSPITAL',
        eta_minutes: assignBody.assignment?.eta_minutes ?? 6,
      },
      fleetId,
    );

    return res.status(200).json({
      success: true,
      case_id: assignBody.case_id,
      message: 'Incoming ER transport simulated',
    });
  });

  app.get('/v1/admin/executive-snapshot', (_req, res) => {
    const snapshot = ExecutiveAnalytics.snapshot({
      dispatchers: WebSocketEngine.dispatcherCount(),
      drivers: WebSocketEngine.driverCount(),
      hospitals: WebSocketEngine.hospitalCount(),
      admins: WebSocketEngine.adminCount(),
    });
    return res.status(200).json(snapshot);
  });

  /**
   * Orchestrated demo: SOS → Amber dispatch AMB-VSKP-07 → driver pipeline → Bay 3 ER intake.
   * Progress events stream on SIMULATION_PROGRESS (admin / dispatch / hospital WS).
   */
  app.post('/v1/simulate/full-chain', (req, res) => {
    const started = FullChainSimulator.begin({
      ihs_uid: req.body?.ihs_uid,
      fleet_id: req.body?.fleet_id,
      bay_id: req.body?.bay_id,
      er_doctor: req.body?.er_doctor,
    });
    if (!started.ok) {
      const code = started.error === 'SIMULATION_ALREADY_RUNNING' ? 409 : 403;
      return res.status(code).json({ error: started.error });
    }
    return res.status(202).json({
      accepted: true,
      message: 'Full emergency chain simulation started',
      steps: 4,
    });
  });

  app.get('/healthz', (_req, res) => {
    const jwtConfigured = Boolean(process.env.JWT_SECRET_KEY);
    const dataReady = isDataPlaneReady();
    const ready = jwtConfigured && dataReady;

    if (!ready) {
      return res.status(503).json({
        status: 'degraded',
        service: 'ihs-cloud-engine',
        ready: false,
        checks: {
          jwt: jwtConfigured ? 'ok' : 'missing',
          data_plane: dataReady ? 'ok' : 'not_ready',
        },
      });
    }

    return res.status(200).json({
      status: 'ok',
      service: 'ihs-cloud-engine',
      ready: true,
      port: PORT,
      endpoints: {
        panic_wss: '/v1/triage/panic',
        dispatch_wss: '/v1/dispatch/stream',
        driver_wss: '/v1/driver/stream',
        hospital_wss: '/v1/hospital/stream',
        admin_wss: '/v1/admin/stream',
        doctor_wss: '/v1/doctor/stream',
        patient_wss: '/v1/patient/stream',
        case_track_wss: '/v1/case/:caseId/track',
      },
      dispatchers_connected: WebSocketEngine.dispatcherCount(),
      drivers_connected: WebSocketEngine.driverCount(),
      hospitals_connected: WebSocketEngine.hospitalCount(),
      admins_connected: WebSocketEngine.adminCount(),
      doctors_connected: WebSocketEngine.doctorCount(),
      runtime: isDemoMode() ? 'local_in_memory' : 'database',
    });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const dispatchWss = new WebSocketServer({ noServer: true });
  const driverWss = new WebSocketServer({ noServer: true });
  const hospitalWss = new WebSocketServer({ noServer: true });
  const adminWss = new WebSocketServer({ noServer: true });
  const doctorWss = new WebSocketServer({ noServer: true });
  const patientWss = new WebSocketServer({ noServer: true });
  const trackWss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname, searchParams } = new URL(
      request.url || '/',
      `http://${request.headers.host}`,
    );

    if (pathname === '/v1/triage/panic') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
      return;
    }

    if (pathname === '/v1/dispatch/stream') {
      dispatchWss.handleUpgrade(request, socket, head, (ws) => {
        dispatchWss.emit('connection', ws, request);
      });
      return;
    }

    if (pathname === '/v1/driver/stream') {
      const fleetId = searchParams.get('fleet_id') || 'AMB-VSKP-07';
      driverWss.handleUpgrade(request, socket, head, (ws) => {
        DriverController.handleConnection(ws, fleetId);
      });
      return;
    }

    if (pathname === '/v1/hospital/stream') {
      hospitalWss.handleUpgrade(request, socket, head, (ws) => {
        HospitalController.handleConnection(ws);
      });
      return;
    }

    if (pathname === '/v1/admin/stream') {
      adminWss.handleUpgrade(request, socket, head, (ws) => {
        AdminController.handleConnection(ws);
      });
      return;
    }

    if (pathname === '/v1/doctor/stream') {
      doctorWss.handleUpgrade(request, socket, head, (ws) => {
        DoctorController.handleConnection(ws);
      });
      return;
    }

    if (pathname === '/v1/patient/stream') {
      const ihsUid = searchParams.get('ihs_uid') || 'IHS-ADMIN-00001';
      patientWss.handleUpgrade(request, socket, head, (ws) => {
        DoctorController.handlePatientConnection(ws, ihsUid);
      });
      return;
    }

    const trackMatch = pathname.match(/^\/v1\/case\/([^/]+)\/track$/);
    if (trackMatch) {
      const caseId = decodeURIComponent(trackMatch[1]);
      trackWss.handleUpgrade(request, socket, head, (ws) => {
        WebSocketEngine.registerCaseTracker(ws, caseId);
        ws.send(
          JSON.stringify({
            event: 'TRACK_SUBSCRIBED',
            payload: { case_id: caseId },
          }),
        );
      });
      return;
    }

    socket.destroy();
  });

  wss.on('connection', (ws) => {
    PanicController.handleIncomingConnection(ws);
  });

  dispatchWss.on('connection', (ws) => {
    PanicController.registerDispatcher(ws);
  });

  if (!isDemoMode()) {
    FleetComplianceDaemon.initialize();
    DataComplianceDaemon.initialize();
  }

  server.listen(PORT, () => {
    console.log(`🚀 IHS Cloud Engine listening on :${PORT}`);
    console.log(`   Mode:         ${isDemoMode() ? 'DEMO (in-memory)' : 'DATABASE'}`);
    console.log(`   WSS panic:    /v1/triage/panic`);
    console.log(`   WSS dispatch: /v1/dispatch/stream`);
    console.log(`   WSS driver:   /v1/driver/stream?fleet_id=…`);
    console.log(`   WSS hospital: /v1/hospital/stream`);
    console.log(`   WSS admin:    /v1/admin/stream`);
    console.log(`   WSS doctor:   /v1/doctor/stream`);
    console.log(`   WSS patient:  /v1/patient/stream?ihs_uid=…`);
    console.log(`   WSS track:    /v1/case/:caseId/track`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start Cloud Engine', error);
  process.exit(1);
});
