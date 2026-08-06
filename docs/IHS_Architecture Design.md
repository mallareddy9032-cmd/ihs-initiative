### **STEP 1.1: PostgreSQL Cloud Schema (Core & Financial)**

SQL  
\-- \==============================================================================  
\-- 1\. ENUMS & EXTENSIONS  
\-- \==============================================================================  
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; \-- Required for AES-256 hot-store encryption

CREATE TYPE subscription\_tier AS ENUM ('TIER\_2\_STANDARD', 'TIER\_3\_NRI\_PROXY', 'EXPIRED', 'PENDING\_RENEWAL');  
CREATE TYPE audit\_event\_type AS ENUM ('SYSTEM\_ACCESS', 'E\_SIGNATURE\_APPLIED', 'MLC\_SAFE\_HARBOR\_TRIGGERED', 'GLACIER\_COLD\_MIGRATION');

\-- \==============================================================================  
\-- 2\. CORE IDENTITY (SOVEREIGN RECORD)  
\-- \==============================================================================  
\-- This table is isolated. ihs\_uid is generated at the application layer   
\-- (e.g., IHS-ANTP-00001) and serves as the sovereign public-facing identifier.  
CREATE TABLE patients (  
    internal\_id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    ihs\_uid VARCHAR(20) UNIQUE NOT NULL,   
      
    \-- PII encrypted at rest (AES-256 simulated logic at ORM layer)  
    first\_name VARCHAR(100) NOT NULL,  
    last\_name VARCHAR(100) NOT NULL,  
    dob DATE NOT NULL,  
    gender VARCHAR(10) NOT NULL,  
      
    \-- Location constraints for Dual-Pin verification (\<100m radius rule)  
    home\_lat DECIMAL(10, 7\) NOT NULL,  
    home\_lng DECIMAL(10, 7\) NOT NULL,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    updated\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_patients\_ihs\_uid ON patients(ihs\_uid);

\-- \==============================================================================  
\-- 3\. CAPITATION & ECONOMICS (SUBSCRIPTION ENGINE)  
\-- \==============================================================================  
\-- Manages the ₹799/3-month Tier 2 and Tier 3 NRI proxy economics.  
CREATE TABLE subscriptions (  
    subscription\_id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    patient\_id UUID REFERENCES patients(internal\_id) ON DELETE RESTRICT,  
      
    tier subscription\_tier NOT NULL,  
    status VARCHAR(20) DEFAULT 'ACTIVE',  
      
    \-- NRI Proxy Linkage  
    sponsor\_name VARCHAR(150),  
    sponsor\_contact VARCHAR(20),  
      
    \-- Quota Logic (1 doorstep visit/month)  
    valid\_from TIMESTAMP WITH TIME ZONE NOT NULL,  
    valid\_until TIMESTAMP WITH TIME ZONE NOT NULL,  
    doorstep\_visits\_remaining INTEGER DEFAULT 3, \-- 3 visits for a 3-month cycle  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \==============================================================================  
\-- 4\. DPDP ACT 2023 & NMC WORM AUDIT LEDGER  
\-- \==============================================================================  
\-- Immutable table. NO UPDATE or DELETE statements should ever be granted   
\-- to any database role for this table.  
CREATE TABLE audit\_logs (  
    audit\_id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    ihs\_uid VARCHAR(20) NOT NULL, \-- Indexed for fast NMC compliance pulling  
      
    event\_type audit\_event\_type NOT NULL,  
    actor\_id UUID NOT NULL, \-- Could be a doctor, admin, or system daemon  
      
    \-- SHA-256 signature hash of the transaction (e.g., Doctor signing an Rx)  
    cryptographic\_hash VARCHAR(64) NOT NULL,  
      
    \-- Detailed payload (e.g., JSON snapshot of the state when signed)  
    immutable\_payload JSONB NOT NULL,  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_audit\_ihs\_uid ON audit\_logs(ihs\_uid);

### **Strategic Architect Notes:**

1. **Immutability by Design:** The audit\_logs table is structured to be append-only. In our deployment phase, we will write a PostgreSQL rule/trigger that actively rejects any UPDATE or DELETE commands to this specific table, ensuring 100% legal compliance for medical e-signatures and MLC events.  
2. **Location Baseline:** The home\_lat and home\_lng in the patients table are required at onboarding. This is the "Blue Pin" that the Command Center will constantly reconcile against the Fleet's live "Red Pin" to enforce the $\<100\\text{m}$ verification rule.  
3. **Quota Tracking:** The doorstep\_visits\_remaining integer allows the Phase 9 Billing Engine to easily deduct a visit. If this hits $0$, the system automatically triggers the ₹499 out-of-quota co-pay intercept.

### **STEP 1.2a: PostgreSQL Cloud Schema (Clinical & Telemetry)**

SQL  
\-- \==============================================================================  
\-- 5\. CASE MANAGEMENT & FSM (FINITE STATE MACHINE) TRACKING  
\-- \==============================================================================  
\-- Tracks the 10-Phase SLA and Turnaround Time (TAT) metrics.  
CREATE TYPE case\_status AS ENUM (  
    'INITIATED', 'DISPATCHED', 'ARRIVED\_ON\_SCENE', 'TRIAGE\_IN\_PROGRESS',   
    'TELECONSULT\_ACTIVE', 'SAFE\_HARBOR\_MLC', 'CRITICAL\_TRANSIT\_PENDING', 'CLOSED\_RESOLVED'  
);

CREATE TABLE clinical\_cases (  
    case\_id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    patient\_id UUID REFERENCES patients(internal\_id) ON DELETE RESTRICT,  
    assigned\_fleet\_id VARCHAR(50), \-- Links to outsourced ambulance tender DB  
      
    current\_status case\_status DEFAULT 'INITIATED',  
    is\_mlc boolean DEFAULT FALSE, \-- Flags Safe Harbor Mode  
      
    \-- SLA Turnaround Time (TAT) Timestamps  
    t\_a TIMESTAMP WITH TIME ZONE, \-- Time Accepted (Dispatch assigns)  
    t\_m TIMESTAMP WITH TIME ZONE, \-- Time Mobilized (Velocity \>5km/h threshold)  
    t\_e TIMESTAMP WITH TIME ZONE, \-- Time Ended (Case closed)  
      
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- \==============================================================================  
\-- 6\. BLE GATT TELEMETRY INGESTION (HOT STORE)  
\-- \==============================================================================  
\-- Stores vitals and diagnostic streams from the tablet.   
\-- Ready for Day 31 Cold Vault Migration to AWS Glacier.  
CREATE TABLE diagnostic\_telemetry (  
    telemetry\_id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),  
    case\_id UUID REFERENCES clinical\_cases(case\_id) ON DELETE CASCADE,  
      
    \-- Hardware Identification  
    device\_mac\_address VARCHAR(17) NOT NULL,  
    service\_uuid VARCHAR(10) NOT NULL, \-- e.g., 0x180D (ECG), 0x1822 (SpO2)  
      
    \-- Data Payload  
    reading\_value JSONB NOT NULL, \-- Can hold base64 vectors or scalar floats  
      
    \-- Anti-Fraud & Fallback Flags  
    variance\_fraud\_flag BOOLEAN DEFAULT FALSE, \-- Triggered if SpO2 rolling variance \= 0  
    is\_manual\_fallback BOOLEAN DEFAULT FALSE,  \-- True if 60s BLE timeout occurred  
    photo\_verification\_uuid UUID,              \-- Link to S3/Glacier compressed image ID  
      
    recorded\_at TIMESTAMP WITH TIME ZONE NOT NULL,  
    synced\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

### **STEP 1.2b: SQLite Local Schema (Ruggedized Android Tablet)**

This runs *on the tablet*. Notice the addition of sync-state flags to handle offline durability and bidirectional reconciliation.

SQL  
\-- \==============================================================================  
\-- 1\. LOCAL CASE CACHE (OFFLINE-FIRST)  
\-- \==============================================================================  
CREATE TABLE local\_cases (  
    local\_id INTEGER PRIMARY KEY AUTOINCREMENT,  
    cloud\_case\_id TEXT, \-- Populated if created by Command Center, Null if created offline  
    patient\_ihs\_uid TEXT NOT NULL,  
      
    current\_status TEXT NOT NULL,  
    is\_mlc\_active INTEGER DEFAULT 0, \-- 1 \= Safe Harbor Mode Unlocked  
      
    \-- Sync tracking  
    sync\_status INTEGER DEFAULT 0, \-- 0 \= Pending, 1 \= Synced, 2 \= Conflict  
    last\_modified\_local DATETIME DEFAULT CURRENT\_TIMESTAMP  
);

\-- \==============================================================================  
\-- 2\. LOCAL BLE TELEMETRY BUFFER  
\-- \==============================================================================  
\-- Buffers the high-frequency BLE streams before batch-syncing to Postgres.  
CREATE TABLE local\_telemetry\_buffer (  
    buffer\_id INTEGER PRIMARY KEY AUTOINCREMENT,  
    local\_case\_id INTEGER,  
      
    service\_uuid TEXT NOT NULL,  
    payload TEXT NOT NULL, \-- JSON stringified reading  
      
    \-- Hardware Fallback Constraints  
    is\_manual\_entry INTEGER DEFAULT 0,   
    local\_photo\_path TEXT, \-- Local file URI for the 60s BLE timeout photo  
      
    recorded\_at DATETIME DEFAULT CURRENT\_TIMESTAMP,  
    sync\_status INTEGER DEFAULT 0  
);

### **Strategic Architect Notes:**

1. **SLA TAT Metrics ($\\Delta T$):** The t\_a, t\_m, and t\_e timestamps in clinical\_cases natively support the PRD Phase 2 rule. We can write an API chron-job that calculates $\\Delta T \= T\_M \- T\_A$ and flags a TAT\_MOBILIZATION\_BREACH if the fleet takes too long to reach $\>5\\text{km/h}$ velocity.  
2. **Safe Harbor Integration:** The is\_mlc\_active flag in the SQLite schema is critical. If connectivity drops entirely and a nurse discovers an unannounced MLC on-scene, toggling this to 1 offline will immediately unlock the BLS (Basic Life Support) UI and List-O drugs locally on the tablet, preventing medical abandonment.  
3. **Anti-Fraud Immutability:** If the 60-second BLE pairing times out, the tablet sets is\_manual\_entry \= 1 and requires a local photo path. When the tablet regains connection, the sync engine will push the payload, upload the photo to S3, and write the photo\_verification\_uuid into the PostgreSQL Hot Store.

### **STEP 1.3: TypeScript Master Case FSM Engine**

TypeScript  
// \============================================================================  
// IHS CORE: FINITE STATE MACHINE (FSM)  
// Document Ref: IHS-SOV-OS-2026-V3-FINAL  
// \============================================================================

export enum CaseState {  
  INITIATED \= 'INITIATED',  
  DISPATCHED \= 'DISPATCHED',  
  ARRIVED\_ON\_SCENE \= 'ARRIVED\_ON\_SCENE',  
  TRIAGE\_IN\_PROGRESS \= 'TRIAGE\_IN\_PROGRESS',  
  TELECONSULT\_ACTIVE \= 'TELECONSULT\_ACTIVE',  
  SAFE\_HARBOR\_MLC \= 'SAFE\_HARBOR\_MLC',  
  CRITICAL\_TRANSIT\_PENDING \= 'CRITICAL\_TRANSIT\_PENDING',  
  CLOSED\_RESOLVED \= 'CLOSED\_RESOLVED'  
}

export class IhsCaseFSM {  
  private caseId: string;  
  private patientId: string;  
  private currentState: CaseState;

  constructor(caseId: string, patientId: string, initialState: CaseState \= CaseState.INITIATED) {  
    this.caseId \= caseId;  
    this.patientId \= patientId;  
    this.currentState \= initialState;  
  }

  // \==========================================================================  
  // TRANSITION 1: INITIATED \-\> DISPATCHED (Phase 1 & 9: Capitation Gate)  
  // \==========================================================================  
  async attemptDispatch(): Promise\<{ success: boolean; requiresCoPay?: boolean }\> {  
    if (this.currentState \!== CaseState.INITIATED) throw new Error("Invalid State Transition");

    // PRD P9-1.1: Capitation Quota Audit  
    const quota \= await db.query(\`SELECT doorstep\_visits\_remaining FROM subscriptions WHERE patient\_id \= $1\`, \[this.patientId\]);  
      
    if (quota \> 0\) {  
      // Deduct quota and authorize ₹0 dispatch  
      await db.execute(\`UPDATE subscriptions SET doorstep\_visits\_remaining \= doorstep\_visits\_remaining \- 1 WHERE patient\_id \= $1\`, \[this.patientId\]);  
      await this.updateState(CaseState.DISPATCHED, { t\_a: new Date() }); // Log Time Accepted (T\_A)  
      return { success: true };  
    } else {  
      // PRD P1-5.2: Out-of-Quota Intercept (Locks mobilization until ₹499 clears)  
      return { success: false, requiresCoPay: true };  
    }  
  }

  // \==========================================================================  
  // TRANSITION 2: GLOBAL \-\> SAFE\_HARBOR\_MLC (Phase 3: Medico-Legal Protocol)  
  // \==========================================================================  
  async triggerSafeHarborMode(): Promise\<void\> {  
    // Can be triggered from ANY active state if an MLC is discovered  
    await this.updateState(CaseState.SAFE\_HARBOR\_MLC, { is\_mlc: true });  
      
    // PRD P3-3.1 & P3-3.2: Parallel execution of Safe Harbor protocols  
    await Promise.all(\[  
      this.fireParallelState108Webhook(),     // Notify State Emergency  
      this.unlockTabletBLSDrugs(),            // Unlock List-O OTC stabilization  
      this.openSilentWebRtcMonitor()          // Launch silent 1-way video/audio to Hub  
    \]);  
  }

  // \==========================================================================  
  // TRANSITION 3: TELECONSULT\_ACTIVE \-\> ACUITY ROUTING (Phase 7: Closure)  
  // \==========================================================================  
  async evaluateAcuityAndRoute(vitals: any): Promise\<void\> {  
    if (this.currentState \!== CaseState.TELECONSULT\_ACTIVE) throw new Error("Invalid State Transition");

    // PRD P7-1.1: Acuity Branching Thresholds  
    const isCritical \= vitals.SpO2 \< 90 || vitals.HR \> 130 || vitals.MAP \< 60;

    if (isCritical) {  
      // Force escalation to nearest ER base  
      await this.updateState(CaseState.CRITICAL\_TRANSIT\_PENDING);  
      await this.triggerEmergencyRoutingOverride(); // PRD P7-3.1  
    } else {  
      // Proceed to standard resolution and E-Sign  
      await this.updateState(CaseState.CLOSED\_RESOLVED, { t\_e: new Date() }); // Log Time Ended (T\_E)  
      await this.generateSHA256ESignatureAndInvoice(); // PRD P6-1.3 & P9-2.1  
    }  
  }

  // \==========================================================================  
  // HELPER: STATE MUTATION & AUDIT LOGGING  
  // \==========================================================================  
  private async updateState(newState: CaseState, payload: any \= {}): Promise\<void\> {  
    // 1\. Update PostgeSQL Hot Store  
    await db.execute(\`UPDATE clinical\_cases SET current\_status \= $1 WHERE case\_id \= $2\`, \[newState, this.caseId\]);  
      
    // 2\. Broadcast WebSocket update to Dispatch Hub & Tablet  
    WebSocketEngine.broadcast(this.caseId, { type: 'STATE\_CHANGE', state: newState, payload });  
      
    this.currentState \= newState;  
  }

  // ... (Private helper methods for webhooks, WORM audits, and WebRTC signaling omitted for brevity)  
}

### **Strategic Architect Notes:**

1. **The Capitation Gate (attemptDispatch):** Notice how the system *physically cannot* change the database state to DISPATCHED if the quota is zero. The API will receive { success: false, requiresCoPay: true }, forcing the frontend Client App or Dispatcher UI to render the **₹499 payment gateway**.  
2. **Global MLC Override (triggerSafeHarborMode):** Unlike linear transitions, the SAFE\_HARBOR\_MLC state can override the FSM at any point in the lifecycle. By wrapping the side-effects in a Promise.all(), the system simultaneously alerts the government (108), unlocks the local tablet for the nurse, and opens the panic camera.  
3. **Acuity Branching (evaluateAcuityAndRoute):** The exact clinical metrics ($SpO\_2 \< 90\\%$, $HR \> 130$, $MAP \< 60$) are hardcoded into the resolution pathway. A doctor cannot accidentally close a case as "Routine" if the hardware telemetry ingested these critical values; the FSM will forcibly override the routing to CRITICAL\_TRANSIT\_PENDING.

**Phase B: The Nervous System (REST & Async APIs)**.

### **1\. WebSocket Protocol: Client Panic & Dual-Pin Reconciliation**

This payload definition governs the persistent WebSocket connection (wss://ws.ihs.antp.init/v1/triage/panic) specified in PRD P1-1.1. It handles the 1-tap emergency trigger and the live GPS feed used for Dual-Pin verification.

JSON  
// \============================================================================  
// ASYNC API: WEBSOCKET PAYLOADS (Client \<-\> Command Center)  
// \============================================================================

// 1.1 CLIENT PANIC TRIGGER (Upstream to Cloud)  
{  
  "event": "PANIC\_TRIGGERED",  
  "payload": {  
    "ihs\_uid": "IHS-ANTP-00042",  
    "timestamp": "2026-08-05T11:10:00Z",  
    "live\_gps": {  
      "lat": 14.6818,  
      "lng": 77.6005,  
      "accuracy\_meters": 12.5  
    },  
    // PRD P1-1.3: If WebSocket fails, app serializes this exact payload   
    // into an encrypted AES-256 SMS and fires to the Hub's shortcode.  
    "connection\_type": "WIFI\_LTE"   
  }  
}

// 1.2 DUAL-PIN RECONCILIATION WARNING (Downstream to Hub Dispatcher)  
// Triggered if the live\_gps (Red Pin) \> 100m from home\_lat/lng (Blue Pin)  
{  
  "event": "DUAL\_PIN\_MISMATCH\_ALERT",  
  "payload": {  
    "case\_id": "uuid-v4-string",  
    "deviation\_meters": 245,  
    "warning\_level": "AMBER\_ALERT",  
    "action\_required": "DISPATCHER\_VERIFICATION\_REQUIRED"  
  }  
}

### **2\. WebRTC Signaling: Adaptive Bandwidth Teleconsult**

PRD P5-1.2 dictates that if throughput drops below \<300kbps, the system must aggressively downsample video to 160p to preserve 85% of the pipe for lossless digital stethoscope audio. We control this via the Session Description Protocol (SDP) exchange during the WebRTC handshake.

JavaScript  
// \============================================================================  
// WEBSOCKET SIGNALING: WEBRTC ADAPTIVE NEGOTIATION  
// \============================================================================

const rtcConfiguration \= {  
  iceServers: \[{ urls: 'turn:turn.ihs.antp.init:3478', credential: '...', username: '...' }\],  
  bundlePolicy: 'max-bundle'  
};

// When the tablet detects network degradation, it renegotiates the SDP:  
function onNetworkDegradation(throughputKbps) {  
  if (throughputKbps \< 300\) {  
    // 1\. Force Video Downgrade to 160p  
    const videoSender \= peerConnection.getSenders().find(s \=\> s.track.kind \=== 'video');  
    const parameters \= videoSender.getParameters();  
    parameters.encodings\[0\].maxBitrate \= 45000; // Cap video at 45kbps  
    parameters.encodings\[0\].scaleResolutionDownBy \= 4.0; // Downsample to 160p  
    videoSender.setParameters(parameters);

    // 2\. Protect Stethoscope Audio Channel (Lossless priority)  
    const audioSender \= peerConnection.getSenders().find(s \=\> s.track.kind \=== 'audio');  
    const audioParams \= audioSender.getParameters();  
    audioParams.encodings\[0\].priority \= 'high';  
    audioParams.encodings\[0\].maxBitrate \= 255000; // Allocate remaining 255kbps  
    audioSender.setParameters(audioParams);  
      
    // Broadcast state to Physician Portal UI  
    signalingChannel.send(JSON.stringify({   
      event: "QOS\_DOWNGRADE\_ACTIVE",   
      message: "Low bandwidth: Prioritizing stethoscope audio."   
    }));  
  }  
}

### **3\. OpenAPI 3.0 REST Contract: Local-First Telemetry Sync**

When the Field Staff Tablet operates offline, it writes BLE GATT telemetry to the local SQLite database. Once connectivity is restored, it pushes a batch payload to this REST endpoint.

YAML  
\# \============================================================================  
\# OPENAPI 3.0: TELEMETRY BATCH SYNC  
\# \============================================================================  
openapi: 3.0.0  
info:  
  title: IHS Telemetry Ingestion API  
  version: 1.0.0  
paths:  
  /v1/telemetry/sync:  
    post:  
      summary: Batch sync SQLite telemetry to PostgreSQL Hot Store  
      security:  
        \- BearerAuth: \[\]  
      requestBody:  
        required: true  
        content:  
          application/json:  
            schema:  
              type: object  
              properties:  
                case\_id:  
                  type: string  
                  format: uuid  
                telemetry\_records:  
                  type: array  
                  items:  
                    type: object  
                    properties:  
                      service\_uuid:  
                        type: string  
                        example: "0x180D" \# ECG  
                      reading\_payload:  
                        type: object \# Base64 vectors or scalar JSON  
                      recorded\_at:  
                        type: string  
                        format: date-time  
                      \# PRD P4-2.2: Photo-Verified Fallback  
                      is\_manual\_fallback:  
                        type: boolean  
                        default: false  
                      photo\_verification\_b64:  
                        type: string  
                        description: "Required if is\_manual\_fallback=true. Compressed device photo (\<300KB)."  
      responses:  
        '201':  
          description: Batch successfully ingested and synced.  
        '400':  
          description: Validation failed (e.g., missing photo on manual fallback).

### 

### **Strategic Architect Notes:**

1. **SMS Fallback Resiliency:** Notice the connection\_type inside the panic payload. If the WebSockets fail, the client app's architecture will take that exact JSON object, encrypt it using a pre-shared AES key, and send it as a raw SMS text to a local GSM modem plugged into the Command Center.  
2. **WebRTC QoS (Quality of Service):** The WebRTC code directly manipulates the RTCRtpSender parameters. By hard-capping the video at $45\\text{kbps}$ and elevating the audio priority, we guarantee the doctor never loses the heartbeat audio stream, even if the video becomes highly pixelated on a 2G/3G Edge network connection.  
3. **Photo-Verified Fallback:** The REST API strictly enforces PRD P4-2.2. If is\_manual\_fallback is true but the array lacks the photo\_verification\_b64 string, the server throws a 400 Bad Request. The tablet cannot sync fabricated vital signs without cryptographic photographic proof.

### **4.1 Security & Auth: SHA-256 E-Sign Generation API (PRD P6-1.3)**

When a doctor finalizes a prescription or closes a case, the system must generate an immutable, cryptographically secure hash. This API binds the doctor's identity, the patient's record, and the exact timestamp into a WORM-compliant token.

YAML  
\# \============================================================================  
\# OPENAPI 3.0: DOCTOR E-SIGNATURE ENGINE  
\# \============================================================================  
  /v1/auth/e-sign/generate:  
    post:  
      summary: Generates a SHA-256 token locking the clinical case payload  
      security:  
        \- 6DigitPinAuth: \[\] \# PRD P5-3.2: 6-digit PIN authorization gate  
      requestBody:  
        required: true  
        content:  
          application/json:  
            schema:  
              type: object  
              properties:  
                case\_id:  
                  type: string  
                doctor\_nmc\_id:  
                  type: string  
                prescribed\_drugs:  
                  type: array  
                  items:  
                    type: string  
      responses:  
        '200':  
          description: Returns the SHA-256 hash and updates WORM Audit DB.  
          content:  
            application/json:  
              schema:  
                type: object  
                properties:  
                  sha256\_signature:  
                    type: string  
                    example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"  
                  clinical\_release\_authorized:  
                    type: boolean  
                    default: true \# PRD P6-2.1: WebSocket will now push this to the Tablet

### **4.2 Outbound Webhook: ER Hospital Notification (PRD P2-4.1)**

If the FSM routes a patient to `CRITICAL_TRANSIT_PENDING`, the Cloud Engine must immediately fire a JSON payload to the receiving hospital's ER desk (e.g., GGH Anantapur or KIMS) so they can prep a bed.

JSON  
// \============================================================================  
// OUTBOUND WEBHOOK: ER INTAKE NOTIFICATION  
// Destination: POST https://api.ggh-anantapur.gov.in/v1/er/incoming (Simulated)  
// \============================================================================  
{  
  "event\_type": "INBOUND\_CRITICAL\_AMBULANCE",  
  "ihs\_case\_reference": "uuid-v4-string",  
  "eta\_minutes": 14,  
  "patient\_acuity": {  
    "is\_mlc": false,  
    "primary\_complaint": "Acute Myocardial Infarction (STEMI Suspected)",  
    "latest\_vitals": {  
      "SpO2": 88,  
      "HR": 145,  
      "MAP": 55,  
      "ECG\_Findings": "ST Elevation detected in V3, V4"  
    }  
  },  
  "interventions\_en\_route": \[  
    "Aspirin 300mg PO",  
    "Oxygen at 10L/min via NRB Mask"  
  \]  
}

### **4.3 Financial API: Capitation & Co-Pay Intercept (PRD P1-5.2)**

When the dispatcher or client attempts to initiate a mobilization, the API checks the quota. If the quota is empty, it returns the ₹499 intercept block.

YAML  
\# \============================================================================  
\# OPENAPI 3.0: CAPITATION & MOBILIZATION GATEWAY  
\# \============================================================================  
  /v1/billing/mobilization-check:  
    get:  
      summary: Verifies Capitation Quota and enforces Co-Pay Intercept  
      parameters:  
        \- in: query  
          name: ihs\_uid  
          required: true  
          schema:  
            type: string  
      responses:  
        '200':  
          description: Quota exists. Base fee is ₹0.  
          content:  
            application/json:  
              schema:  
                example:  
                  status: "APPROVED"  
                  fee\_required: 0  
        '402':  
          description: Payment Required (PRD P1-5.2 Intercept)  
          content:  
            application/json:  
              schema:  
                example:  
                  status: "BLOCKED\_OUT\_OF\_QUOTA"  
                  fee\_required: 499  
                  message: "Monthly doorstep quota exceeded. ₹499 co-pay required to dispatch."

### **Step C.1.1: Native Kotlin BLE GATT Daemon (PRD P4-1.1)**

The tablet must constantly scan for our specific medical hardware UUIDs. We use a foreground service so the Android OS does not kill the scanner when the tablet screen turns off or the nurse switches to the camera app.

Kotlin  
// \============================================================================  
// ANDROID KOTLIN: BLE GATT MEDICAL SCANNER DAEMON  
// \============================================================================  
import android.bluetooth.le.\*  
import android.os.ParcelUuid  
import kotlinx.coroutines.\*

class IhsBleScannerDaemon {  
    private val bluetoothLeScanner: BluetoothLeScanner \= bluetoothAdapter.bluetoothLeScanner  
      
    // Medical Service UUIDs as defined in PRD Section 3  
    private val TARGET\_UUIDS \= listOf(  
        "0000180D-0000-1000-8000-00805f9b34fb", // 12-Lead ECG (0x180D)  
        "00001822-0000-1000-8000-00805f9b34fb", // Pulse Oximeter (0x1822)  
        "00001810-0000-1000-8000-00805f9b34fb"  // BP Monitor (0x1810)  
    )

    fun startMedicalDeviceScan() {  
        val filters \= TARGET\_UUIDS.map { uuid \-\>  
            ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(uuid)).build()  
        }

        // PRD P4-1.1: Aggressive scanning for medical devices  
        val settings \= ScanSettings.Builder()  
            .setScanMode(ScanSettings.SCAN\_MODE\_LOW\_LATENCY)  
            .setReportDelay(500L) // Restarts loop/batches every 500ms  
            .build()

        bluetoothLeScanner.startScan(filters, settings, scanCallback)  
    }

    private val scanCallback \= object : ScanCallback() {  
        override fun onScanResult(callbackType: Int, result: ScanResult) {  
            val deviceMac \= result.device.address  
            val rssi \= result.rssi  
            // Route to GATT Connection Manager to ingest vectors  
            GattConnectionManager.connectAndIngest(deviceMac)  
        }  
    }  
}

### **Step C.1.2: The 60-Second Timeout & Photo Fallback (PRD P4-2.1 & P4-2.2)**

If tin-roof interference or a dead device battery breaks the BLE connection, the system must wait exactly 60 seconds. If connection fails, it unlocks manual input but *mandates* a time-stamped photo of the device screen to prevent falsification of vitals.

Kotlin  
// \============================================================================  
// KOTLIN COROUTINES: 60-SECOND TIMEOUT & MANUAL FALLBACK  
// \============================================================================  
class VitalsIngestionViewModel : ViewModel() {  
      
    val uiState \= MutableStateFlow\<IngestionState\>(IngestionState.Scanning)

    fun attemptBleConnection(deviceMac: String) {  
        viewModelScope.launch {  
            // PRD P4-2.1: 60-Second Hard Timeout  
            val connectionResult \= withTimeoutOrNull(60\_000L) {  
                GattConnectionManager.connectSuspend(deviceMac)  
            }

            if (connectionResult \== null) {  
                // Timeout Reached: Lock BLE, Unlock Manual Entry  
                uiState.value \= IngestionState.ManualFallbackRequired(  
                    reason \= "BLE\_TIMEOUT\_60S",  
                    requiresPhotoEvidence \= true // PRD P4-2.2  
                )  
                triggerCameraIntent()  
            } else {  
                uiState.value \= IngestionState.StreamingActive  
            }  
        }  
    }

    private fun onPhotoCaptured(compressedImageUri: String) {  
        // Appends image to SQLite local DB before allowing manual vital entry  
        LocalDatabase.telemetryBufferDao().insertManualFallbackPhoto(  
            caseId \= currentCaseId,  
            photoUri \= compressedImageUri,  
            timestamp \= System.currentTimeMillis()  
        )  
        uiState.value \= IngestionState.ManualFieldsUnlocked  
    }  
}

### **Step C.1.3: Safe Harbor MLC & Cold-Chain Monitors (PRD P3-3.1 & P3-4.2)**

The UI layer must react to physical realities immediately, even if offline.

Kotlin  
// \============================================================================  
// TABLET UI/STATE LOGIC: SAFE HARBOR & COLD CHAIN   
// \============================================================================

// 1\. SAFE HARBOR MLC OVERRIDE  
fun toggleSafeHarborMode() {  
    // 1\. Immediately unlock local SQLite drug database for Basic Life Support (BLS)  
    LocalDatabase.medicationDao().unlockListODrugs()  
      
    // 2\. Queue parallel webhooks (fires immediately if online, syncs later if offline)  
    SyncWorker.queuePriorityTask(TaskType.FIRE\_108\_WEBHOOK)  
      
    // 3\. Activate front-facing camera for silent WebRTC monitoring  
    HardwareController.activateSilentCameraStream()  
}

// 2\. COLD CHAIN DAEMON  
fun monitorSampleStorageTemp(currentTempCelsius: Float, durationMinutes: Int) {  
    // PRD P3-4.2: Biological cold-chain monitor  
    if (currentTempCelsius \> 8.0f && durationMinutes \> 15\) {  
        // Sample is compromised. Lock UI and force discard workflow.  
        SystemAlerts.triggerHighContrastRedAlert("COLD\_CHAIN\_BREACH\_DETECTED")  
        LocalDatabase.caseDao().lockAccessionSync()   
    }  
}

### **Strategic Architect Notes:**

1. **Battery vs. Latency:** Medical BLE (`SCAN_MODE_LOW_LATENCY`) drains battery quickly. The tablet must be docked to the ambulance's 12V inverter when not physically at the patient's bedside.  
2. **Offline Durability:** By using `SyncWorker.queuePriorityTask()`, if the nurse triggers Safe Harbor MLC in a concrete stairwell with zero 4G, the tablet unlocks the BLS drugs *instantly* based on local SQLite logic. The 108 webhook simply waits in a queue and fires the millisecond the tablet touches an LTE tower outside.  
3. **Photo Compression:** Uncompressed 8MP camera photos are 3-5MB. The `triggerCameraIntent()` will route through an on-device JPEG compression utility to crush the file to `<300KB` before writing to SQLite, ensuring we don't clog the network pipe during the REST batch sync defined in Phase B.

**Step C.2: The Client App Architecture (iOS / Android)**

The Client App is the primary touchpoint for the 1,200 enrolled family units and their NRI/Tier 3 sponsors. Unlike the Field Staff Tablet, which handles complex Bluetooth hardware, the Client App's architecture is optimized for **zero-friction emergency initiation, absolute network resiliency, and proxy routing**.

We will design this using React Native (TypeScript) to maintain a unified cross-platform codebase, utilizing native bridges for SMS routing and background GPS processing.

### **1\. The Panic Engine & Network Resilience Protocol**

In an emergency, the user cannot wait for a loading spinner. The app must instantly attempt a WebSocket connection, and if it fails to resolve within 1,500ms, it must seamlessly pivot to the **Encrypted SMS Fallback** (PRD P1-1.3).

| Network State | Active Protocol | Target Destination | Payload Security |
| :---- | :---- | :---- | :---- |
| **4G / Wi-Fi Active** | wss:// WebSocket | Cloud API Gateway | TLS 1.3 / WSS Encryption |
| **Edge / 2G / No Data** | Cellular SMS | Command Center GSM Modem | AES-256 Pre-Shared Key |
| **Offline / No Signal** | Local Queue | Android/iOS Job Scheduler | Appends to Local Cache |

#### **Code Specification: React Native Panic Trigger & SMS Fallback**

TypeScript  
// \============================================================================  
// REACT NATIVE: ONE-TAP PANIC ENGINE & SMS FALLBACK  
// \============================================================================  
import { NativeModules } from 'react-native';  
import CryptoJS from 'crypto-js';

const SMSBridge \= NativeModules.DirectSmsModule;   
const COMMAND\_CENTER\_SHORTCODE \= "54321"; // Dedicated IHS GSM Modem

export class EmergencyTriggerEngine {  
  private socket: WebSocket;  
  private ihsUid: string;  
  private encryptionKey: string; // Provisioned at login

  constructor(ihsUid: string, key: string) {  
    this.ihsUid \= ihsUid;  
    this.encryptionKey \= key;  
  }

  async firePanic(currentLocation: { lat: number, lng: number }) {  
    const payload \= {  
      event: "PANIC\_TRIGGERED",  
      ihs\_uid: this.ihsUid,  
      timestamp: new Date().toISOString(),  
      gps: currentLocation  
    };

    try {  
      // 1\. Attempt WebSocket Transmission (Timeout: 1500ms)  
      await this.transmitOverWss(payload);  
    } catch (networkError) {  
      // 2\. PRD P1-1.3: Background Encrypted SMS Fallback  
      this.executeSmsFallback(payload);  
    }  
  }

  private executeSmsFallback(payload: any) {  
    // Stringify and encrypt the JSON payload using AES-256  
    const stringifiedPayload \= JSON.stringify(payload);  
    const encryptedPayload \= CryptoJS.AES.encrypt(  
      stringifiedPayload,   
      this.encryptionKey  
    ).toString();

    // Fire native SMS bridge bypasses user's default SMS app UI for zero friction  
    // Format: IHS\_SOS::\<Encrypted\_String\>  
    SMSBridge.sendDirectSms(COMMAND\_CENTER\_SHORTCODE, \`IHS\_SOS::${encryptedPayload}\`);  
  }  
}

### **2\. Tier 3 NRI Proxy & Frictionless Location (PRD P1-3.2)**

The Tier 3 subscription model allows an adult child living abroad (the Sponsor) to manage healthcare for aging parents in Anantapur. This introduces a critical architectural challenge: **If the NRI sponsor presses the Panic Button in Dallas, the GPS coordinates sent cannot be from Dallas.**

#### **Code Specification: Proxy Routing & Dual-Pin Verification**

TypeScript  
// \============================================================================  
// CLIENT STATE: NRI PROXY ROUTING & DUAL-PIN VALIDATION  
// \============================================================================

export const evaluateLocationPayload \= (  
    isProxySponsor: boolean,   
    liveDeviceGps: { lat: number, lng: number },   
    registeredHomeGps: { lat: number, lng: number }  
) \=\> {  
      
    if (isProxySponsor) {  
        // TIER 3 LOGIC:   
        // Force the dispatch pin to the parent's registered home address,   
        // completely ignoring the sponsor's live device GPS.  
        return {  
            dispatch\_pin: registeredHomeGps,  
            is\_proxy\_dispatch: true,  
            warning\_flag: "PROXY\_INITIATED\_REMOTE"  
        };  
    }

    // TIER 2 LOGIC (Standard User):  
    // Calculate Haversine distance between Red Pin (Live) and Blue Pin (Home)  
    const distanceMeters \= calculateHaversineDistance(liveDeviceGps, registeredHomeGps);

    if (distanceMeters \> 100\) {  
        // PRD P1-3.2: Dual-Pin Reconciliation Warning (\>100m)  
        return {  
            dispatch\_pin: liveDeviceGps,  
            is\_proxy\_dispatch: false,  
            warning\_flag: "DUAL\_PIN\_MISMATCH\_ALERT",  
            deviation\_meters: distanceMeters  
        };  
    }

    // Standard in-home dispatch  
    return {  
        dispatch\_pin: registeredHomeGps,  
        is\_proxy\_dispatch: false,  
        warning\_flag: null  
    };  
};

### **Strategic Architect Notes:**

* **Native SMS Permissions:** For Android, SEND\_SMS permissions must be requested during onboarding to allow the background SMS bridge to function without opening the default messaging UI. For iOS, due to strict App Store sandboxing, the fallback will invoke MFMessageComposeViewController, pre-filling the encrypted payload and requiring one physical tap from the user to send.  
* **Encrypted Payload Size:** An AES-encrypted JSON object fits well within the 160-character limit of a standard SMS if we minify the keys (e.g., mapping ihs\_uid to i, timestamp to t).  
* **Viral Referral Loop:** The 60-day trial/30-day extension loop mentioned in the App PRD will be handled via deep links (ihs://referral?code=XXXX). When parsed at runtime, this maps directly to the PostgreSQL subscriptions table, automatically pushing the valid\_until timestamp outward without dispatcher intervention.

### **Step D.1.1: Dual-Pin Reconciliation UI Engine (PRD P1-3.2)**

When a panic signal arrives, the UI must immediately plot two pins. If the Red Pin (Live GPS) and Blue Pin (Home Base) diverge by more than $100\\text{m}$, the UI must physically block the standard "Dispatch" button and force the operator to verify the anomaly.

TypeScript  
// \============================================================================  
// REACT/TYPESCRIPT: COMMAND CENTER DUAL-PIN DISPATCH BOARD  
// \============================================================================  
import React, { useState } from 'react';  
import { calculateDistance } from '@/utils/geo';  
import { FsmEngineApi } from '@/api/fsm';

interface DispatchRequest {  
  ihs\_uid: string;  
  isProxy: boolean;  
  homeGps: { lat: number; lng: number }; // Blue Pin  
  liveGps: { lat: number; lng: number }; // Red Pin  
}

export const DispatchReconciliationUI: React.FC\<{ request: DispatchRequest }\> \= ({ request }) \=\> {  
  const \[overrideReason, setOverrideReason\] \= useState\<string\>("");

  // Calculate deviation automatically on render  
  const distanceMeters \= calculateDistance(request.homeGps, request.liveGps);  
  const isAmberAlert \= distanceMeters \> 100 && \!request.isProxy;

  const handleDispatch \= async () \=\> {  
    // Phase 1 / Phase 9: Financial Capitation Gate  
    const dispatchResult \= await FsmEngineApi.attemptDispatch(request.ihs\_uid);  
      
    if (dispatchResult.requiresCoPay) {  
       // PRD P1-5.2: Out-of-Quota Intercept triggers ₹499 payment UI  
       triggerCoPayGateway(request.ihs\_uid, 499);  
       return;  
    }  
    executeFleetMobilization(request.ihs\_uid);  
  };

  return (  
    \<div className="dispatch-panel"\>  
      {/\* MAP LAYER: Renders Mapbox GL JS \*/}  
      \<MapBoard bluePin={request.homeGps} redPin={request.liveGps} /\>

      {/\* AMBER ALERT GATE \*/}  
      {isAmberAlert ? (  
        \<div className="alert-box amber"\>  
          \<strong\>⚠️ LOCATION MISMATCH ({Math.round(distanceMeters)}m)\</strong\>  
          \<p\>Live GPS deviates from registered home address.\</p\>  
          \<select onChange={(e) \=\> setOverrideReason(e.target.value)}\>  
            \<option value=""\>Select Override Reason...\</option\>  
            \<option value="NEIGHBOR\_HOUSE"\>Patient at neighbor's house\</option\>  
            \<option value="GPS\_DRIFT"\>Confirmed GPS drift (Phone verification)\</option\>  
          \</select\>  
          \<button disabled={\!overrideReason} onClick={handleDispatch}\>  
            Acknowledge & Force Dispatch  
          \</button\>  
        \</div\>  
      ) : (  
        \<button className="btn-primary" onClick={handleDispatch}\>  
          Initiate Fleet Dispatch  
        \</button\>  
      )}  
    \</div\>  
  );  
};

### **Step D.1.2: Pre-Dispatch MLC Screening Gate (PRD P1-2.1)**

Before a dispatcher can even view the map board for a non-panic call (e.g., a phone-in request), they must clear the Medico-Legal Case (MLC) matrix.

| Screening Question | Response | System Action |
| :---- | :---- | :---- |
| Is this related to poisoning, assault, or suicide? | **YES** | Hard-locks dispatch. Displays State-108 Redirection Script. |
| Is the patient unconscious due to an accident? | **YES** | Hard-locks dispatch. Displays State-108 Redirection Script. |
| Is this a routine fever, chronic pain, or known cardiac issue? | **YES** | Unlocks map board. Proceeds to Capitation check. |

TypeScript  
// \============================================================================  
// REACT/TYPESCRIPT: PRE-DISPATCH MLC SCREENING MATRIX  
// \============================================================================  
export const MlcScreeningGate: React.FC\<{ onClear: () \=\> void }\> \= ({ onClear }) \=\> {  
  const \[isMlc, setIsMlc\] \= useState\<boolean | null\>(null);

  if (isMlc \=== true) {  
    return (  
      \<div className="lockout-screen red-alert"\>  
        \<h2\>🚨 MLC PROTOCOL TRIGGERED\</h2\>  
        \<p\>IHS Fleet cannot be dispatched for suspected medico-legal cases.\</p\>  
        \<div className="script-box"\>  
          \<strong\>Read to caller:\</strong\>  
          "Sir/Madam, based on your symptoms, we are required by law to transfer this call to the State 108 Emergency Service. Please stay on the line, I am patching you through now."  
        \</div\>  
        \<button onClick={patchTo108System}\>Transfer Call to 108 / 112\</button\>  
      \</div\>  
    );  
  }

  return (  
    \<div className="intake-form"\>  
      \<h3\>Pre-Dispatch Triage\</h3\>  
      {/\* Buttons set isMlc state. If false, onClear() unmounts this component and shows DispatchReconciliationUI \*/}  
    \</div\>  
  );  
};

### **Step D.1.3: Silent WebRTC Panic Monitor (PRD P3-3.2)**

If the field tablet triggers **Safe Harbor Mode**, it secretly opens a 1-way WebRTC feed. The Command Center UI must automatically pop this video feed open in a minimized, muted window for the Shift Supervisor, silently logging the footage to AWS as evidence.

TypeScript  
// \============================================================================  
// REACT/TYPESCRIPT: SILENT WEBRTC MONITOR DAEMON  
// \============================================================================  
import { useEffect, useRef } from 'react';  
import { initializeWebRtcSubscriber } from '@/utils/webrtc';

export const SilentMonitorDaemon \= () \=\> {  
  const videoRef \= useRef\<HTMLVideoElement\>(null);

  useEffect(() \=\> {  
    // Listens to Phase B WebSocket for SAFE\_HARBOR\_MLC triggers  
    const sub \= WebSocketEngine.subscribe("SAFE\_HARBOR\_MLC", (payload) \=\> {  
      // Connect to the incoming WebRTC feed without alerting the UI aggressively  
      const stream \= initializeWebRtcSubscriber(payload.case\_id);  
      if (videoRef.current) {  
        videoRef.current.srcObject \= stream;  
      }  
      // Trigger background DVR recording to AWS  
      triggerEvidentiaryRecording(payload.case\_id, stream);  
    });  
    return () \=\> sub.unsubscribe();  
  }, \[\]);

  // Renders a small, muted video element in the corner of the Dispatcher's screen  
  return (  
    \<div className="security-feed-overlay"\>  
      \<video ref={videoRef} autoPlay muted playsInline /\>  
      \<span className="live-indicator"\>🔴 REC (SAFE HARBOR)\</span\>  
    \</div\>  
  );  
};

### **Strategic Architect Notes:**

1. **State Injection:** Notice that the out-of-quota intercept (₹499) is called *inside* the UI logic but is powered by the FSM we built in Phase A. The UI is completely "dumb" to the database; it only reacts to the strict boolean returns from our FsmEngineApi.  
2. **Audio Discipline:** The SilentMonitorDaemon explicitly forces muted on the \<video\> tag. If a dispatcher is on a phone call with another patient, a sudden blast of audio from a chaotic field MLC event would disrupt operations. The supervisor can click to unmute.  
3. **Predictive Relocation (Noted for Future):** The Mapbox integration used in DispatchReconciliationUI is configured to overlay a heat map. Between 08:00 PM and 06:00 AM (during the retainer allowance period), the map will calculate the centroid of the highest tier-2 subscriber clusters and automatically suggest repositioning coordinates to the parked ambulances to reduce cold-start $T\_A \\to T\_M$ metrics.

**Step D.2: The Physician Console Portal (Web View)**

The Physician Console is the clinical nerve center of the IHS. Because doctors are making diagnostic decisions based on remote telemetry, this portal must prioritize zero-latency rendering of cardiac vectors and strictly enforce pharmaceutical inventory math.

We will architect this using **React (TypeScript)** with an **HTML5 `<canvas>`** engine for high-performance ECG rendering, bypassing standard DOM manipulation which would lag under the weight of continuous BLE telemetry arrays.

### **Step D.2.1: The Split-View UI & QoS Monitor (PRD P5-1)**

The interface strictly divides the physician's cognitive load.

* **Left Hemisphere:** Real-time, high-acuity data (Live WebRTC video, digital stethoscope audio, real-time vitals, and the live ECG stream).  
* **Right Hemisphere:** Historical context and clinical action (Scrollable cold-vault PDFs, past visit notes, and the E-Prescription pad).

TypeScript  
// \============================================================================  
// REACT/TYPESCRIPT: SPLIT-VIEW PHYSICIAN CONSOLE  
// \============================================================================  
import React, { useState, useEffect } from 'react';

export const PhysicianConsole: React.FC\<{ caseId: string }\> \= ({ caseId }) \=\> {  
  const \[qosWarning, setQosWarning\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    // Listens for the WebRTC QoS Downgrade triggered in Phase B  
    const sub \= signalingChannel.subscribe("QOS\_DOWNGRADE\_ACTIVE", (msg) \=\> {  
      setQosWarning(msg.message); // e.g., "Low bandwidth: Prioritizing stethoscope audio."  
    });  
    return () \=\> sub.unsubscribe();  
  }, \[\]);

  return (  
    \<div className="console-layout grid grid-cols-2 h-screen w-full"\>  
      {/\* LEFT PANEL: REAL-TIME ACUITY \*/}  
      \<section className="left-panel border-r-2 border-gray-800 p-4"\>  
        {qosWarning && \<div className="banner bg-red-600 text-white font-bold"\>{qosWarning}\</div\>}  
          
        \<div className="video-audio-cluster"\>  
          \<WebRtcVideoPlayer caseId={caseId} priority="adaptive" /\>  
          \<StethoscopeAudioPlayer caseId={caseId} priority="lossless-high" /\>  
        \</div\>  
          
        \<div className="telemetry-cluster mt-4"\>  
          \<LiveVitalsRibbon caseId={caseId} /\>  
          \<EcgLiveCanvas caseId={caseId} /\>  
        \</div\>  
      \</section\>

      {/\* RIGHT PANEL: HISTORY & CLINICAL ACTION \*/}  
      \<section className="right-panel p-4 overflow-y-auto"\>  
        \<HistoricalRecordsViewer patientId={caseId} /\>  
        \<hr className="my-4" /\>  
        \<StockAwareRxPad caseId={caseId} /\>  
      \</section\>  
    \</div\>  
  );  
};

### **Step D.2.2: Live 12-Lead ECG Canvas Engine (PRD P4-1.1 & P5-1)**

The ECG hardware (Service UUID `0x180D`) streams raw voltage vectors as base64 strings. Rendering thousands of data points per second using standard SVG or React state would freeze the browser. We must use an HTML5 `<canvas>` coupled with `requestAnimationFrame` for a smooth, oscilloscope-like 60fps sweep.

TypeScript  
// \============================================================================  
// HTML5 CANVAS: 60FPS OSCILLOSCOPE ECG RENDERER  
// \============================================================================  
import React, { useEffect, useRef } from 'react';

export const EcgLiveCanvas: React.FC\<{ caseId: string }\> \= ({ caseId }) \=\> {  
  const canvasRef \= useRef\<HTMLCanvasElement\>(null);  
    
  useEffect(() \=\> {  
    const canvas \= canvasRef.current;  
    if (\!canvas) return;  
    const ctx \= canvas.getContext('2d');  
    let animationFrameId: number;  
    let xOffset \= 0;

    // Connect to the WebSocket telemetry feed established in Phase B  
    const ws \= new WebSocket(\`wss://ws.ihs.antp.init/v1/telemetry/stream/${caseId}\`);  
      
    ws.onmessage \= (event) \=\> {  
      const data \= JSON.parse(event.data);  
      if (data.service\_uuid \=== "0x180D") {  
        // Decode base64 vector array to Float32  
        const voltages \= decodeBase64ToFloat32(data.reading\_value);  
        drawWaveform(ctx, voltages);  
      }  
    };

    const drawWaveform \= (ctx: CanvasRenderingContext2D, voltages: Float32Array) \=\> {  
      ctx.beginPath();  
      ctx.strokeStyle \= "\#00FF00"; // Classic high-contrast green  
      ctx.lineWidth \= 1.5;

      voltages.forEach((voltage) \=\> {  
        // Map voltage to canvas Y-axis coordinates  
        const y \= mapVoltageToY(voltage, canvas.height);   
          
        if (xOffset \=== 0\) ctx.moveTo(xOffset, y);  
        else ctx.lineTo(xOffset, y);  
          
        xOffset \+= 2; // Sweep speed  
          
        // Wrap around like a traditional monitor  
        if (xOffset \>= canvas.width) {  
          xOffset \= 0;  
          ctx.clearRect(0, 0, canvas.width, canvas.height);   
        }  
      });  
      ctx.stroke();  
    };

    return () \=\> {  
      ws.close();  
      cancelAnimationFrame(animationFrameId);  
    };  
  }, \[caseId\]);

  return \<canvas ref={canvasRef} width={800} height={200} className="bg-black rounded" /\>;  
};

### **Step D.2.3: Stock-Aware Rx Pad & E-Sign Gate (PRD P5-3.1, P5-3.2, P6-1.1, P6-1.3)**

This is where clinical decisions hit operational reality. The doctor cannot prescribe a drug that the deployed ambulance does not physically carry. Selecting an item immediately updates the PostgreSQL database to block another doctor from claiming the same physical box of medicine.

TypeScript  
// \============================================================================  
// REACT/TYPESCRIPT: STOCK-AWARE RX PAD & SHA-256 GATE  
// \============================================================================  
import React, { useState, useEffect } from 'react';  
import { InventoryApi, AuthApi } from '@/api/core';

export const StockAwareRxPad: React.FC\<{ caseId: string }\> \= ({ caseId }) \=\> {  
  const \[availableStock, setAvailableStock\] \= useState\<DrugItem\[\]\>(\[\]);  
  const \[selectedDrugs, setSelectedDrugs\] \= useState\<string\[\]\>(\[\]);  
  const \[sixDigitPin, setSixDigitPin\] \= useState\<string\>("");  
  const \[isLocked, setIsLocked\] \= useState\<boolean\>(false);

  // 1\. Fetch FEFO (First-Expire-First-Out) active stock mapped to this specific vehicle  
  useEffect(() \=\> {  
    InventoryApi.getVehicleStock(caseId).then(setAvailableStock);  
  }, \[caseId\]);

  // 2\. Pre-Reservation Lock (PRD P5-3.2)  
  const handleSelectDrug \= async (drugId: string) \=\> {  
    const success \= await InventoryApi.preReserveStock(drugId, caseId); // Sets STOCK\_PRE\_RESERVED  
    if (success) {  
      setSelectedDrugs(\[...selectedDrugs, drugId\]);  
    } else {  
      alert("Conflict: Drug just reserved by another active case.");  
    }  
  };

  // 3\. SHA-256 E-Signature Authorization (PRD P6-1.1 & P6-1.3)  
  const handleAuthorizeRx \= async () \=\> {  
    if (sixDigitPin.length \!== 6\) return;

    try {  
      // Calls the /v1/auth/e-sign/generate API built in Phase B  
      const response \= await AuthApi.generateESignature({  
        case\_id: caseId,  
        prescribed\_drugs: selectedDrugs,  
        doctor\_pin: sixDigitPin  
      });

      // UI locks permanently to WORM compliance standard  
      setIsLocked(true);  
      alert(\`Rx Authorized. SHA-256 Hash: ${response.sha256\_signature}\`);  
        
    } catch (error) {  
      alert("Authorization Failed: Invalid PIN.");  
    }  
  };

  return (  
    \<div className="rx-pad"\>  
      \<h3\>Active Vehicle Inventory\</h3\>  
      {/\* Medication Dropdown \*/}  
      \<select onChange={(e) \=\> handleSelectDrug(e.target.value)} disabled={isLocked}\>  
        \<option\>Select Medication...\</option\>  
        {availableStock.map(drug \=\> (  
          \<option key={drug.id} value={drug.id}\>  
            {drug.name} (Qty: {drug.available\_qty} | Exp: {drug.expiry\_date})  
          \</option\>  
        ))}  
      \</select\>

      {/\* Authorization Gate \*/}  
      \<hr className="my-4" /\>  
      \<div className="auth-gate bg-gray-100 p-4"\>  
        \<h4\>Physician Authorization\</h4\>  
        \<input   
          type="password"   
          maxLength={6}   
          placeholder="Enter 6-Digit PIN"   
          value={sixDigitPin}  
          onChange={(e) \=\> setSixDigitPin(e.target.value)}  
          disabled={isLocked}  
        /\>  
        \<button onClick={handleAuthorizeRx} disabled={isLocked} className="btn-secure"\>  
          {isLocked ? "AUTHORIZED & LOCKED" : "APPLY SHA-256 E-SIGNATURE"}  
        \</button\>  
      \</div\>  
    \</div\>  
  );  
};

### **Strategic Architect Notes:**

1. **Hardware-to-Browser Synchronization:** The `EcgLiveCanvas` component directly resolves the data stream originating from the native Android Kotlin Daemon (Phase C). By mapping the base64 string back to a `Float32Array` on the browser thread, we bypass the need for heavy server-side processing, distributing the compute load to the physician's desktop.  
2. **Eliminating Phantom Prescriptions:** In a standard hospital, a doctor prescribes a drug and the pharmacy fills it. In a mobile fleet model, the ambulance *is* the pharmacy. If two doctors are consulting two different patients from the same ambulance, the `InventoryApi.preReserveStock()` function ensures a race condition doesn't result in two prescriptions for the last vial of Adrenaline.  
3. **Form Field Hard-Lockout:** Once the `AuthApi.generateESignature` returns a success, the React `isLocked` state is permanently set to true. The UI chemically binds to the WORM standard established in Phase A—no edits, no deletions, just an immutable cryptographic record.

**Phase E (Deploy, Admin, & Audit).**

### **Step E.1: The Fleet Governance & FEFO Procurement Engine**

To maintain our target MRR and operational efficiency, we cannot rely on human administrators to check ambulance insurance expirations or count pill boxes. The system must autonomously disable non-compliant assets and auto-generate Purchase Orders (POs) based on **First-Expire-First-Out (FEFO)** logic.

TypeScript  
// \============================================================================  
// NODE.JS WORKER: FLEET COMPLIANCE & FEFO PROCUREMENT (Runs Daily at 00:00)  
// \============================================================================  
import { db } from '@/utils/db';  
import { generateDraftPoPdf } from '@/utils/pdfGenerator';

export class AdminAutomationDaemon {  
    
  // 1\. FLEET TENDER COMPLIANCE GATE (PRD P2-1.1)  
  static async auditFleetCompliance() {  
    console.log("Starting Daily Fleet Compliance Audit...");  
      
    // Finds active outsourced ambulances where insurance or fitness expires today  
    const query \= \`  
      UPDATE outsourced\_fleet\_assets   
      SET status \= 'INACTIVE\_NON\_COMPLIANT'  
      WHERE status \= 'ACTIVE'   
      AND (insurance\_expiry\_date \< CURRENT\_DATE OR fitness\_cert\_expiry \< CURRENT\_DATE)  
      RETURNING fleet\_id, operator\_name;  
    \`;  
      
    const { rows: groundedFleet } \= await db.execute(query);  
      
    if (groundedFleet.length \> 0\) {  
      // Trigger urgent webhooks to Command Center to route calls to remaining fleet  
      this.alertCommandCenter(groundedFleet);  
    }  
  }

  // 2\. FEFO PROCUREMENT AUTO-PO GENERATOR (PRD P10-1.3)  
  static async sweepInventoryAndGeneratePOs() {  
    console.log("Starting FEFO Procurement Sweep...");  
      
    // Identifies stock where count is below buffer OR expiry is within 30 days  
    const query \= \`  
      SELECT item\_id, item\_name, current\_stock, buffer\_level, expiry\_date, vendor\_id  
      FROM hub\_inventory  
      WHERE current\_stock \<= buffer\_level   
         OR expiry\_date \<= CURRENT\_DATE \+ INTERVAL '30 days'  
    \`;  
      
    const { rows: criticalItems } \= await db.execute(query);  
      
    // Group by Vendor and generate Draft POs  
    const vendorGroups \= this.groupByVendor(criticalItems);  
      
    for (const \[vendorId, items\] of Object.entries(vendorGroups)) {  
      const draftPoPath \= await generateDraftPoPdf(vendorId, items);  
      await db.execute(  
        \`INSERT INTO draft\_purchase\_orders (vendor\_id, file\_path, status) VALUES ($1, $2, 'PENDING\_APPROVAL')\`,   
        \[vendorId, draftPoPath\]  
      );  
    }  
  }  
}

### **Step E.2: DPDP Act 2023 Cold Vault Migration (PRD P10-2.1)**

Under the Digital Personal Data Protection (DPDP) Act 2023 and NMC 2020 guidelines, we cannot keep heavy media files (like the 60-second BLE timeout photos or WebRTC MLC video recordings) in active PostgreSQL storage indefinitely.

At exactly **Day 31**, a migration daemon must strip the AES-256 hot data, apply a tokenized salt mask, shift the binary blobs to an AWS Glacier Cold Vault, and leave behind only a cryptographic pointer in the hot database.

TypeScript  
// \============================================================================  
// AWS SDK / NODE.JS: DAY 31 COLD VAULT MIGRATION DAEMON  
// \============================================================================  
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";  
import crypto from "crypto";  
import { db } from '@/utils/db';

const glacierClient \= new S3Client({ region: "ap-south-1" }); // Mumbai Region for Data Sovereignty  
const GLACIER\_BUCKET \= "ihs-antp-cold-vault-wrm";

export class DataComplianceDaemon {

  static async executeHotToColdShift() {  
    console.log("Initiating Day 31 Hot-to-Cold Vault Shift...");

    // Find all media/telemetry older than 30 days still in Hot Storage  
    const query \= \`  
      SELECT telemetry\_id, ihs\_uid, photo\_verification\_b64, recorded\_at   
      FROM diagnostic\_telemetry   
      WHERE recorded\_at \< CURRENT\_DATE \- INTERVAL '30 days'  
      AND vault\_status \= 'HOT\_STORE'  
    \`;  
    const { rows: agingRecords } \= await db.execute(query);

    for (const record of agingRecords) {  
      if (\!record.photo\_verification\_b64) continue;

      // 1\. Generate Tokenized Salt Mask for Anonymization  
      const salt \= crypto.randomBytes(16).toString('hex');  
      const tokenizedKey \= crypto.createHash('sha256')  
                                 .update(record.ihs\_uid \+ salt)  
                                 .digest('hex');  
        
      const vaultObjectKey \= \`vaults/telemetry/${record.recorded\_at.getFullYear()}/${tokenizedKey}.img\`;

      // 2\. Transfer to AWS Glacier (Deep Archive)  
      const command \= new PutObjectCommand({  
        Bucket: GLACIER\_BUCKET,  
        Key: vaultObjectKey,  
        Body: Buffer.from(record.photo\_verification\_b64, 'base64'),  
        StorageClass: "GLACIER", // Locks it into cheap, cold WORM storage  
        ServerSideEncryption: "aws:kms"  
      });

      await glacierClient.send(command);

      // 3\. Purge Hot Data & Update Ledger  
      // The heavy base64 string is deleted, replaced by the Glacier URI and Salt.  
      await db.execute(\`  
        UPDATE diagnostic\_telemetry   
        SET photo\_verification\_b64 \= NULL,   
            vault\_status \= 'AWS\_GLACIER',  
            glacier\_uri \= $1,  
            anonymization\_salt \= $2  
        WHERE telemetry\_id \= $3  
      \`, \[vaultObjectKey, salt, record.telemetry\_id\]);  
    }  
      
    console.log(\`Migrated ${agingRecords.length} records to Glacier Cold Vault.\`);  
  }  
}

### **Strategic Architect Notes:**

1. **Procurement Cash Flow:** The FEFO Auto-PO generator specifically creates *Draft* POs in a `PENDING_APPROVAL` state. This prevents runaway algorithms from draining the company's bank account. An administrator logs in, reviews the auto-generated PDF, and clicks "Approve" to send it to vendors (e.g., L\&T-SuFin or local distributors).  
2. **Absolute Liability Protection:** The `auditFleetCompliance()` daemon physically removes non-compliant ambulances from the dispatch pool. If an outsourced driver's insurance expires at midnight, by 12:01 AM, the Command Center UI (built in Phase D) will physically not be able to assign them a case. This completely shields IHS from vicarious liability in the event of an accident.  
3. **Data Cost Optimization:** AWS Glacier is fractions of a cent per gigabyte compared to Hot RDS PostgreSQL storage. By ruthlessly migrating media at Day 31, we keep the PostgreSQL database lean, fast, and cheap, while satisfying strict government medical data retention laws.

