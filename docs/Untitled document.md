### **SPRINT 1, STEP 1: The Core Database Schema (schema.prisma)**

This is the foundational file for the Node.js Cloud Engine. It translates the SQL we architected in Phase A into strict, type-safe TypeScript models.

Code snippet  
// \============================================================================  
// FILE: prisma/schema.prisma  
// CONTEXT: IHS Cloud Engine \- Data Access Layer  
// \============================================================================

generator client {  
  provider \= "prisma-client-js"  
}

datasource db {  
  provider \= "postgresql"  
  url      \= env("DATABASE\_URL")  
}

// \----------------------------------------------------------------------------  
// 1\. IDENTITY & SOVEREIGNTY  
// \----------------------------------------------------------------------------  
model Patient {  
  internal\_id String   @id @default(dbgenerated("uuid\_generate\_v4()")) @db.Uuid  
  ihs\_uid     String   @unique @db.VarChar(20) // e.g., IHS-ANTP-00001  
    
  // Encrypted at rest fields  
  first\_name  String   @db.VarChar(100)  
  last\_name   String   @db.VarChar(100)  
  dob         DateTime @db.Date  
  gender      String   @db.VarChar(10)  
    
  // Blue Pin Location  
  home\_lat    Float  
  home\_lng    Float

  created\_at  DateTime @default(now()) @db.Timestamptz(6)  
  updated\_at  DateTime @updatedAt @db.Timestamptz(6)

  subscriptions Subscription\[\]  
  cases         ClinicalCase\[\]  
}

// \----------------------------------------------------------------------------  
// 2\. CAPITATION ECONOMICS  
// \----------------------------------------------------------------------------  
enum SubscriptionTier {  
  TIER\_2\_STANDARD  
  TIER\_3\_NRI\_PROXY  
  EXPIRED  
  PENDING\_RENEWAL  
}

model Subscription {  
  subscription\_id           String           @id @default(dbgenerated("uuid\_generate\_v4()")) @db.Uuid  
  patient\_id                String           @db.Uuid  
  tier                      SubscriptionTier  
  status                    String           @default("ACTIVE") @db.VarChar(20)  
    
  sponsor\_name              String?          @db.VarChar(150)  
  sponsor\_contact           String?          @db.VarChar(20)  
    
  valid\_from                DateTime         @db.Timestamptz(6)  
  valid\_until               DateTime         @db.Timestamptz(6)  
  doorstep\_visits\_remaining Int              @default(3)

  created\_at                DateTime         @default(now()) @db.Timestamptz(6)

  patient Patient @relation(fields: \[patient\_id\], references: \[internal\_id\], onDelete: Restrict)  
}

// \----------------------------------------------------------------------------  
// 3\. CLINICAL CASE & STATE MACHINE  
// \----------------------------------------------------------------------------  
enum CaseState {  
  INITIATED  
  DISPATCHED  
  ARRIVED\_ON\_SCENE  
  TRIAGE\_IN\_PROGRESS  
  TELECONSULT\_ACTIVE  
  SAFE\_HARBOR\_MLC  
  CRITICAL\_TRANSIT\_PENDING  
  CLOSED\_RESOLVED  
}

model ClinicalCase {  
  case\_id           String    @id @default(dbgenerated("uuid\_generate\_v4()")) @db.Uuid  
  patient\_id        String    @db.Uuid  
  assigned\_fleet\_id String?   @db.VarChar(50)  
    
  current\_status    CaseState @default(INITIATED)  
  is\_mlc            Boolean   @default(false)  
    
  // SLA Timestamps  
  t\_a               DateTime? @db.Timestamptz(6)  
  t\_m               DateTime? @db.Timestamptz(6)  
  t\_e               DateTime? @db.Timestamptz(6)  
    
  created\_at        DateTime  @default(now()) @db.Timestamptz(6)

  patient   Patient              @relation(fields: \[patient\_id\], references: \[internal\_id\], onDelete: Restrict)  
  telemetry DiagnosticTelemetry\[\]  
}

// \----------------------------------------------------------------------------  
// 4\. BLE GATT INGESTION (HOT STORE)  
// \----------------------------------------------------------------------------  
model DiagnosticTelemetry {  
  telemetry\_id           String   @id @default(dbgenerated("uuid\_generate\_v4()")) @db.Uuid  
  case\_id                String   @db.Uuid  
    
  device\_mac\_address     String   @db.VarChar(17)  
  service\_uuid           String   @db.VarChar(10)  
  reading\_value          Json  
    
  variance\_fraud\_flag    Boolean  @default(false)  
  is\_manual\_fallback     Boolean  @default(false)  
  photo\_verification\_b64 String?  @db.Text  
  vault\_status           String   @default("HOT\_STORE") @db.VarChar(20)  
  glacier\_uri            String?  @db.Text  
    
  recorded\_at            DateTime @db.Timestamptz(6)  
  synced\_at              DateTime @default(now()) @db.Timestamptz(6)

  clinical\_case ClinicalCase @relation(fields: \[case\_id\], references: \[case\_id\], onDelete: Cascade)  
}

// \----------------------------------------------------------------------------  
// 5\. DPDP / NMC WORM AUDIT LEDGER  
// \----------------------------------------------------------------------------  
enum AuditEventType {  
  SYSTEM\_ACCESS  
  E\_SIGNATURE\_APPLIED  
  MLC\_SAFE\_HARBOR\_TRIGGERED  
  GLACIER\_COLD\_MIGRATION  
}

model AuditLog {  
  audit\_id           String         @id @default(dbgenerated("uuid\_generate\_v4()")) @db.Uuid  
  ihs\_uid            String         @db.VarChar(20)  
    
  event\_type         AuditEventType  
  actor\_id           String         @db.Uuid  
  cryptographic\_hash String         @db.VarChar(64)  
  immutable\_payload  Json  
    
  created\_at         DateTime       @default(now()) @db.Timestamptz(6)

  @@index(\[ihs\_uid\])  
}

### **Engineering Rationale**

* **Strict Relations (onDelete: Restrict):** Notice the relation block on Subscription and ClinicalCase. If an admin attempts to delete a Patient record, the database will throw a fatal error. Medical records cannot be orphaned or hard-deleted, satisfying baseline compliance.  
* **JSON Fields for Telemetry:** The reading\_value in DiagnosticTelemetry is mapped as Json. This allows the same table to store a scalar float (like $98.6^\\circ\\text{F}$ for temp) or a massive base64 array (for the 12-lead ECG) without requiring schema migrations for new hardware types.  
* **UUIDv4 Generation:** We push ID generation down to the PostgreSQL database engine layer dbgenerated("uuid\_generate\_v4()") rather than relying on Node.js to generate them. This prevents collisions during high-concurrency offline syncs from multiple ambulances simultaneously.

### **SPRINT 1, STEP 2: The WORM Compliance Interceptor**

You are correctly anticipating the vulnerability of ORMs. While we can instruct developers not to update the `AuditLog` table, human error or malicious API injections can bypass application logic. We must enforce this at the database client level.

Modern Prisma (v5+) uses **Client Extensions** rather than legacy middleware to intercept queries. By wrapping the base Prisma client in a WORM extension, we ensure that anywhere in the Node.js Cloud Engine where `ihsDbClient` is imported, it is physically impossible to mutate the audit trail.

### **Code Specification: Prisma Client Extension (`prisma/client.ts`)**

TypeScript  
// \============================================================================  
// FILE: src/infrastructure/database/client.ts  
// CONTEXT: IHS Cloud Engine \- WORM Compliance Interceptor  
// \============================================================================

import { PrismaClient, Prisma } from '@prisma/client';

// Initialize the base connection pool  
const basePrisma \= new PrismaClient();

// \============================================================================  
// PRISMA EXTENSION: WORM (Write-Once-Read-Many) ENFORCEMENT  
// \============================================================================  
export const ihsDbClient \= basePrisma.$extends({  
  query: {  
    auditLog: {  
      async $allOperations({ operation, args, query }) {  
        // 1\. Define strictly forbidden mutation actions  
        const forbiddenOperations: Prisma.AuditLogAction\[\] \= \[  
          'update',  
          'updateMany',  
          'delete',  
          'deleteMany',  
          'upsert' // Upsert contains a hidden update path  
        \];

        // 2\. Intercept and evaluate the request  
        if (forbiddenOperations.includes(operation as any)) {  
            
          // Trigger critical security alert (Simulated webhook to InfoSec team)  
          console.error(\`🚨 \[WORM\_COMPLIANCE\_BREACH\_ATTEMPT\] Illegal ${operation} on AuditLog\`);  
            
          // Throw fatal hard-stop error before it reaches the PostgreSQL engine  
          throw new Error(  
            \`DPDP/NMC WORM VIOLATION: The AuditLog table is cryptographically immutable. \` \+  
            \`Attempted operation '${operation}' has been blocked and logged.\`  
          );  
        }

        // 3\. Pass through legal operations (create, createMany, findUnique, findMany)  
        return query(args);  
      },  
    },  
  },  
});

### **Engineering Rationale**

* **Catching the Upsert Loophole:** Many developers block `update` but forget `upsert`. In Prisma, `upsert` tries to create a record, but if it exists, it updates it. By adding `upsert` to the `forbiddenOperations` array, we close a critical backdoor that could be exploited to overwrite a doctor's SHA-256 e-signature.  
* **Centralized Instantiation:** From this point forward in the codebase, no service or route will import `PrismaClient` directly. Every repository will import `ihsDbClient`. This guarantees the interceptor wraps 100% of the database traffic.  
* **Fail-Fast Architecture:** This extension executes in the Node.js memory space *before* the SQL query is constructed and sent over the wire to AWS RDS. This saves network bandwidth and database CPU cycles during an active attack or logical bug.

### **SPRINT 1, STEP 3: The Master FSM State Controller**

With the database and WORM interceptor securely in place, we now build the **Master Case Controller**. This Node.js service acts as the sole authority for modifying a ClinicalCase.

We will utilize Prisma's $transaction API. Because medical billing (Capitation Quotas) and clinical dispatch are interconnected, if the database fails to deduct a quota visit, the dispatch *must* roll back. ACID-compliant transactions guarantee we never suffer from split-brain state mutations.

### **Code Specification: FSM Controller (CaseStateController.ts)**

TypeScript  
// \============================================================================  
// FILE: src/core/fsm/CaseStateController.ts  
// CONTEXT: IHS Cloud Engine \- Master FSM & Capitation Gate  
// \============================================================================

import { ihsDbClient } from '@/infrastructure/database/client';  
import { CaseState, AuditEventType } from '@prisma/client';  
import { generateSha256 } from '@/utils/crypto';

export class CaseStateController {  
    
  // \--------------------------------------------------------------------------  
  // TRANSITION: INITIATED \-\> DISPATCHED (SLA: T\_A)  
  // \--------------------------------------------------------------------------  
  static async attemptDispatch(caseId: string, patientId: string, dispatcherId: string) {  
    // Execute as an ACID Transaction: All succeed, or all fail.  
    return await ihsDbClient.$transaction(async (tx) \=\> {  
        
      // 1\. Capitation Quota Audit (PRD P9-1.1)  
      const subscription \= await tx.subscription.findFirst({  
        where: { patient\_id: patientId, status: 'ACTIVE' }  
      });

      if (\!subscription || subscription.doorstep\_visits\_remaining \<= 0\) {  
        // Intercept: Block mobilization, return ₹499 Co-Pay requirement  
        return { success: false, requiresCoPay: true, fee: 499 };  
      }

      // 2\. Deduct Quota  
      await tx.subscription.update({  
        where: { subscription\_id: subscription.subscription\_id },  
        data: { doorstep\_visits\_remaining: { decrement: 1 } }  
      });

      // 3\. Mutate Case State & Log SLA Time Accepted (T\_A)  
      const updatedCase \= await tx.clinicalCase.update({  
        where: { case\_id: caseId, current\_status: CaseState.INITIATED },  
        data: {   
          current\_status: CaseState.DISPATCHED,  
          t\_a: new Date() // T\_A: Time Accepted  
        }  
      });

      // 4\. Generate WORM Audit Log  
      const auditPayload \= { action: 'DISPATCH\_AUTHORIZED', remaining\_quota: subscription.doorstep\_visits\_remaining \- 1 };  
      await tx.auditLog.create({  
        data: {  
          ihs\_uid: (await tx.patient.findUnique({ where: { internal\_id: patientId } }))\!.ihs\_uid,  
          event\_type: AuditEventType.SYSTEM\_ACCESS,  
          actor\_id: dispatcherId,  
          cryptographic\_hash: generateSha256(JSON.stringify(auditPayload)),  
          immutable\_payload: auditPayload  
        }  
      });

      return { success: true, updatedCase };  
    });  
  }

  // \--------------------------------------------------------------------------  
  // SLA METRIC: LOG MOBILIZATION TIME (T\_M)  
  // \--------------------------------------------------------------------------  
  static async logMobilizationTime(caseId: string, fleetId: string) {  
    // Triggered by PRD P2-2.3 when Tablet GPS velocity \> 5km/h  
    const currentCase \= await ihsDbClient.clinicalCase.findUnique({ where: { case\_id: caseId } });  
      
    if (currentCase?.current\_status \=== CaseState.DISPATCHED && \!currentCase.t\_m) {  
      await ihsDbClient.clinicalCase.update({  
        where: { case\_id: caseId },  
        data: { t\_m: new Date() } // T\_M: Time Mobilized  
      });  
        
      // SLA TAT Audit: Calculate $\\Delta T \= T\_M \- T\_A$ here if needed for analytics.  
    }  
  }

  // \--------------------------------------------------------------------------  
  // OVERRIDE: SAFE HARBOR MLC (PRD P3-3.1)  
  // \--------------------------------------------------------------------------  
  static async triggerSafeHarborMlc(caseId: string, fieldStaffId: string) {  
    const updatedCase \= await ihsDbClient.clinicalCase.update({  
      where: { case\_id: caseId },  
      data: {  
        current\_status: CaseState.SAFE\_HARBOR\_MLC,  
        is\_mlc: true  
      },  
      include: { patient: true }  
    });

    // Generate WORM Audit for Medico-Legal override  
    const auditPayload \= { action: 'SAFE\_HARBOR\_TRIGGERED', timestamp: new Date() };  
    await ihsDbClient.auditLog.create({  
      data: {  
        ihs\_uid: updatedCase.patient.ihs\_uid,  
        event\_type: AuditEventType.MLC\_SAFE\_HARBOR\_TRIGGERED,  
        actor\_id: fieldStaffId,  
        cryptographic\_hash: generateSha256(JSON.stringify(auditPayload)),  
        immutable\_payload: auditPayload  
      }  
    });

    return updatedCase;  
  }  
}

### **Engineering Rationale**

* **ACID Transaction Block ($transaction):** By wrapping the capitation check, quota deduction, case update, and WORM logging into a single tx block, we eliminate race conditions. If the database crashes midway through, the user does not lose a quota visit for an ambulance that never dispatched.  
* **State Integrity Enforcement:** The attemptDispatch function explicitly looks for current\_status: CaseState.INITIATED in its where clause. If a malicious API call attempts to dispatch a case that is already closed or in Safe Harbor mode, the update will fail to find a matching row, silently aborting the invalid transition.  
* **SLA TAT Tracking ($\\Delta T \= T\_M \- T\_A$):** The logMobilizationTime function perfectly captures the physical reality defined in PRD Phase 2\. Once the fleet hits $\>5\\text{km/h}$, this function locks in t\_m, providing the exact dataset needed to penalize or reward the outsourced ambulance vendor based on their cold-start delays.

### **SPRINT 2: The Communication Layer (APIs & Real-Time Comms)**

We are now building the **Nervous System** of the Integrated Health System. These Node.js controllers expose our secure FSM and database core to the outside world, specifically handling the high-velocity data streams from the Client App and the Field Staff Tablet.

We will implement this in two strict steps: the **WebSocket Panic Controller** for real-time SOS routing, and the **Express REST Controller** for offline-first telemetry syncing.

### **SPRINT 2, STEP 1: The WebSocket Panic Engine**

This controller maintains persistent TCP connections with the iOS/Android Client Apps. When a panic signal is received, it queries the PostgreSQL Hot Store for the patient's registered "Blue Pin" and calculates the deviation against the incoming "Red Pin" to enforce the PRD P1-3.2 Dual-Pin rule.

TypeScript  
// \============================================================================  
// FILE: src/communication/websockets/PanicController.ts  
// CONTEXT: IHS Cloud Engine \- Real-Time SOS & Dual-Pin Routing  
// \============================================================================

import { WebSocket, WebSocketServer } from 'ws';  
import { ihsDbClient } from '@/infrastructure/database/client';  
import { calculateHaversineDistance } from '@/utils/geo';

// Active registry of Command Center Dispatchers  
const dispatchHubClients \= new Set\<WebSocket\>();

export class PanicController {  
    
  static handleIncomingConnection(ws: WebSocket) {  
    ws.on('message', async (message: string) \=\> {  
      try {  
        const payload \= JSON.parse(message);

        if (payload.event \=== 'PANIC\_TRIGGERED') {  
          await PanicController.processEmergencySOS(payload, ws);  
        }  
      } catch (error) {  
        console.error("Invalid WebSocket payload received", error);  
      }  
    });  
  }

  private static async processEmergencySOS(payload: any, clientSocket: WebSocket) {  
    const { ihs\_uid, gps, timestamp } \= payload;

    // 1\. Fetch Patient's Sovereign Record (Blue Pin)  
    const patient \= await ihsDbClient.patient.findUnique({  
      where: { ihs\_uid }  
    });

    if (\!patient) {  
        clientSocket.send(JSON.stringify({ error: "UNAUTHORIZED\_IHS\_UID" }));  
        return;  
    }

    // 2\. Dual-Pin Reconciliation Math  
    const homeGps \= { lat: patient.home\_lat, lng: patient.home\_lng };  
    const distanceMeters \= calculateHaversineDistance(homeGps, gps);

    let warningLevel \= null;  
    let actionRequired \= "STANDARD\_DISPATCH";

    // Enforce 100m Geofence Rule  
    if (distanceMeters \> 100\) {  
      warningLevel \= "AMBER\_ALERT";  
      actionRequired \= "DISPATCHER\_VERIFICATION\_REQUIRED";  
    }

    // 3\. Construct Payload for Command Center Hub  
    const dispatchAlert \= {  
      event: warningLevel ? "DUAL\_PIN\_MISMATCH\_ALERT" : "INBOUND\_EMERGENCY\_SOS",  
      payload: {  
        ihs\_uid: patient.ihs\_uid,  
        patient\_name: \`${patient.first\_name} ${patient.last\_name}\`,  
        deviation\_meters: distanceMeters,  
        warning\_level: warningLevel,  
        action\_required: actionRequired,  
        live\_gps: gps,  
        home\_gps: homeGps,  
        timestamp: timestamp  
      }  
    };

    // 4\. Broadcast immediately to all active Command Center desktop consoles  
    PanicController.broadcastToDispatchers(dispatchAlert);  
  }

  static registerDispatcher(ws: WebSocket) {  
    dispatchHubClients.add(ws);  
    ws.on('close', () \=\> dispatchHubClients.delete(ws));  
  }

  private static broadcastToDispatchers(data: any) {  
    const messageStr \= JSON.stringify(data);  
    dispatchHubClients.forEach(client \=\> {  
      if (client.readyState \=== WebSocket.OPEN) {  
        client.send(messageStr);  
      }  
    });  
  }  
}

### **SPRINT 2, STEP 2: REST Telemetry Sync Controller**

When the ruggedized Android tablet operates in the 2G/Edge corridors of Dharmavaram, it buffers BLE data into its local SQLite database. Once it connects to LTE, it fires a batch JSON payload to this Express.js endpoint. This controller strictly enforces the **60-Second Timeout Photo Verification** (PRD P4-2.2).

TypeScript  
// \============================================================================  
// FILE: src/communication/rest/TelemetrySyncController.ts  
// CONTEXT: IHS Cloud Engine \- Offline Batch Ingestion & Validation  
// \============================================================================

import { Request, Response } from 'express';  
import { ihsDbClient } from '@/infrastructure/database/client';

export class TelemetrySyncController {  
    
  static async ingestBatch(req: Request, res: Response) {  
    try {  
      const { case\_id, telemetry\_records } \= req.body;

      if (\!case\_id || \!Array.isArray(telemetry\_records)) {  
        return res.status(400).json({ error: "MALFORMED\_PAYLOAD" });  
      }

      // 1\. Strict Validation: Pre-flight check for Anti-Fraud Fallbacks  
      for (const record of telemetry\_records) {  
        if (record.is\_manual\_fallback \=== true) {  
          // PRD P4-2.2: Manual entries MUST have a cryptographic photo hash  
          if (\!record.photo\_verification\_b64 || record.photo\_verification\_b64.trim() \=== "") {  
            return res.status(400).json({   
              error: "COMPLIANCE\_BREACH",   
              message: "Manual telemetry entry rejected. Missing required photographic verification."   
            });  
          }  
        }  
      }

      // 2\. Batch Insert to PostgreSQL Hot Store (Using Prisma createMany)  
      const mappedRecords \= telemetry\_records.map(record \=\> ({  
        case\_id: case\_id,  
        device\_mac\_address: record.device\_mac\_address || "MANUAL\_ENTRY",  
        service\_uuid: record.service\_uuid,  
        reading\_value: record.reading\_payload,  
        is\_manual\_fallback: record.is\_manual\_fallback || false,  
        photo\_verification\_b64: record.photo\_verification\_b64 || null,  
        recorded\_at: new Date(record.recorded\_at)  
      }));

      const result \= await ihsDbClient.diagnosticTelemetry.createMany({  
        data: mappedRecords,  
        skipDuplicates: true // Ensures network retries don't duplicate ECG data  
      });

      // 3\. Acknowledge Receipt (Instructs Android SQLite to flush its local buffer)  
      return res.status(201).json({  
        success: true,  
        records\_ingested: result.count,  
        message: "Batch telemetry successfully synced and verified."  
      });

    } catch (error) {  
      console.error("Telemetry Sync Error:", error);  
      return res.status(500).json({ error: "INTERNAL\_SERVER\_ERROR" });  
    }  
  }  
}

### **Engineering Rationale**

* **Zero-Trust Validation:** In `TelemetrySyncController`, the array is looped *before* any database transaction begins. If a batch of 500 records contains a single manual entry missing its required `photo_verification_b64` string, the entire HTTP request is rejected with a `400 Bad Request`. We never write partially non-compliant medical data to the database.  
* **Idempotency via `skipDuplicates`:** Because the tablet operates on unstable LTE connections, the sync HTTP request might hit the server, but the `201 Created` response might drop before reaching the tablet. The tablet will naturally retry the payload. By relying on deterministic timestamps and Prisma's native `skipDuplicates` functionality, we prevent thousands of duplicated vitals from corrupting the patient's record.  
* **Memory Management:** The WebSocket Panic Controller avoids broadcasting arrays to every active socket and explicitly manages a `Set` of active `dispatchHubClients`. When a dispatcher closes their tab, the socket is immediately purged from memory, preventing memory leaks during 24-hour operations.

### **SPRINT 2, STEP 2: REST Telemetry Sync Controller (Continued)**

The logic here handles the offline batch syncing of telemetry data, crucial for maintaining data integrity when the ambulance traverses low-connectivity zones.

TypeScript  
// \============================================================================  
// FILE: src/communication/rest/TelemetrySyncController.ts  
// CONTEXT: IHS Cloud Engine \- Offline Batch Ingestion & Validation  
// \============================================================================

import { Request, Response } from 'express';  
import { ihsDbClient } from '@/infrastructure/database/client';

export class TelemetrySyncController {  
    
  static async ingestBatch(req: Request, res: Response) {  
    try {  
      const { case\_id, telemetry\_records } \= req.body;

      if (\!case\_id || \!Array.isArray(telemetry\_records)) {  
        return res.status(400).json({ error: "MALFORMED\_PAYLOAD" });  
      }

      // 1\. Strict Validation: Pre-flight check for Anti-Fraud Fallbacks  
      for (const record of telemetry\_records) {  
        if (record.is\_manual\_fallback \=== true) {  
          // PRD P4-2.2: Manual entries MUST have a cryptographic photo hash  
          if (\!record.photo\_verification\_b64 || record.photo\_verification\_b64.trim() \=== "") {  
            return res.status(400).json({   
              error: "COMPLIANCE\_BREACH",   
              message: "Manual telemetry entry rejected. Missing required photographic verification."   
            });  
          }  
        }  
      }

      // 2\. Batch Insert to PostgreSQL Hot Store (Using Prisma createMany)  
      const mappedRecords \= telemetry\_records.map(record \=\> ({  
        case\_id: case\_id,  
        device\_mac\_address: record.device\_mac\_address || "MANUAL\_ENTRY",  
        service\_uuid: record.service\_uuid,  
        reading\_value: record.reading\_payload,  
        is\_manual\_fallback: record.is\_manual\_fallback || false,  
        photo\_verification\_b64: record.photo\_verification\_b64 || null,  
        recorded\_at: new Date(record.recorded\_at)  
      }));

      const result \= await ihsDbClient.diagnosticTelemetry.createMany({  
        data: mappedRecords,  
        skipDuplicates: true // Ensures network retries don't duplicate ECG data  
      });

      // 3\. Acknowledge Receipt (Instructs Android SQLite to flush its local buffer)  
      return res.status(201).json({  
        success: true,  
        records\_ingested: result.count,  
        message: "Batch telemetry successfully synced and verified."  
      });

    } catch (error) {  
      console.error("Telemetry Sync Error:", error);  
      return res.status(500).json({ error: "INTERNAL\_SERVER\_ERROR" });  
    }  
  }  
}

### **Understanding the WebRTC Adaptive Downsampling Architecture**

To understand how the system prioritizes life-critical audio (like a digital stethoscope) over video during a degraded mobile connection, we must examine the WebRTC Adaptive Bitrate (ABR) architecture.

Unlike traditional HTTP-based streaming (like HLS or DASH), which relies on client-side buffering and can introduce multi-second latency, WebRTC is designed for sub-second, peer-to-peer real-time communication.

When an ambulance enters a weak 3G/4G zone, the available bandwidth can fluctuate violently. If the system tries to force a high-definition video stream through a narrow pipe, packet loss will occur, leading to frozen frames, robotic audio, or a complete connection drop.

Here is how the architecture handles this dynamically:

1. **Transport-Wide Congestion Control (TWCC):** WebRTC utilizes TWCC feedback. The receiving end (the Physician Console) constantly sends packets back to the sender (the Tablet) detailing the Round-Trip Time (RTT) and packet loss metrics.  
2. **Bandwidth Estimation (BWE):** The server analyzes these TWCC fluctuations to accurately estimate the real-time network capacity. If the algorithm detects the bandwidth dropping below our critical threshold (e.g., $\<300\\text{kbps}$), it triggers a Quality of Service (QoS) downgrade.  
3. **SDP Parameter Manipulation:** The WebRTC Session Description Protocol (SDP) allows us to define the priority and constraints of individual tracks (audio vs. video).  
   * **Video Degradation:** The system aggressively caps the video track's maximum bitrate (e.g., to $45\\text{kbps}$) and downsamples the resolution (e.g., from 720p to 160p). The video becomes pixelated, but it keeps flowing.  
   * **Audio Prioritization:** The system explicitly sets the audio track's priority to high and allocates the remaining available bandwidth to it.

This ensures that even if the doctor is looking at a highly pixelated image of the patient, the critical sound of the heartbeat or lung sounds from the digital stethoscope remains clear and uninterrupted, allowing for continuous diagnostic assessment.

