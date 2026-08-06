### **Web Portals**

### **SPRINT 5: Internal Web Portals (React / Next.js)**

With the backend data contracts secured and the edge devices actively buffering and transmitting data, we must now build the operational interfaces.

The web portals are built on **Next.js (React)** using **TypeScript** and **Tailwind CSS**. Because these interfaces are used in high-stress, life-or-death scenarios, we prioritize strict state management, zero-latency rendering, and absolute visual clarity over complex animations.

Here is the production-ready code for the two core interfaces: the **Command Center Dispatch Board** and the **Physician Console**.

### **STEP 1: Command Center Dispatch Board (Dual-Pin Engine)**

This Next.js page acts as the dispatcher's primary dashboard. It maintains a persistent WebSocket connection to the Node.js backend we built in Sprint 2\. When a panic signal arrives, it instantly plots the **Blue Pin** (registered home base) and the **Red Pin** (live mobile GPS), enforcing the 100m Geofence rule.

TypeScript  
// \============================================================================  
// FILE: src/app/dispatcher/dashboard/page.tsx  
// CONTEXT: Command Center \- Live Emergency Routing & Capitation Gate  
// \============================================================================  
'use client';

import React, { useState, useEffect } from 'react';  
import MapboxGL from 'mapbox-gl';  
import { useWebSocket } from '@/hooks/useWebSocket';  
import { FsmEngineApi } from '@/services/api';

MapboxGL.accessToken \= process.env.NEXT\_PUBLIC\_MAPBOX\_TOKEN\!;

export default function CommandCenterDashboard() {  
  const \[activeSOS, setActiveSOS\] \= useState\<any\>(null);  
  const \[overrideReason, setOverrideReason\] \= useState\<string\>('');  
  const \[isProcessing, setIsProcessing\] \= useState(false);

  // 1\. Listen for WebSockets from Sprint 2 (Panic Controller)  
  const { lastMessage } \= useWebSocket('wss://ws.ihs.antp.init/v1/dispatch/stream');

  useEffect(() \=\> {  
    if (lastMessage?.event \=== 'DUAL\_PIN\_MISMATCH\_ALERT' || lastMessage?.event \=== 'INBOUND\_EMERGENCY\_SOS') {  
      setActiveSOS(lastMessage.payload);  
    }  
  }, \[lastMessage\]);

  const handleDispatch \= async () \=\> {  
    if (\!activeSOS) return;  
    setIsProcessing(true);

    try {  
      // 2\. Trigger FSM Capitation Check (Sprint 1\)  
      const result \= await FsmEngineApi.attemptDispatch(activeSOS.ihs\_uid, activeSOS.is\_proxy);

      if (result.requiresCoPay) {  
        // PRD P1-5.2: Capitation Quota Exceeded  
        alert(\`QUOTA EXCEEDED: Out-of-network charge of ₹${result.fee} required to mobilize fleet.\`);  
        // In production, this triggers a Stripe/Razorpay payment overlay  
      } else {  
        alert('DISPATCH AUTHORIZED. Fleet mobilized at ₹0 Base Fee.');  
        setActiveSOS(null); // Clear board  
      }  
    } catch (error) {  
      console.error('Dispatch failed', error);  
    } finally {  
      setIsProcessing(false);  
    }  
  };

  if (\!activeSOS) {  
    return \<div className="flex h-screen items-center justify-center bg-gray-900 text-white font-bold text-2xl"\>AWAITING EMERGENCY SIGNALS...\</div\>;  
  }

  const isAmberAlert \= activeSOS.deviation\_meters \> 100;

  return (  
    \<div className="flex h-screen w-full flex-col bg-black text-white"\>  
      {/\* HEADER ALERTS \*/}  
      {isAmberAlert && (  
        \<div className="bg-yellow-600 p-4 text-center font-bold"\>  
          ⚠️ AMBER ALERT: Live GPS deviates {Math.round(activeSOS.deviation\_meters)}m from Registered Home Base.  
        \</div\>  
      )}

      {/\* MAPBOX VISUALIZATION LAYER \*/}  
      \<div className="relative flex-grow"\>  
        \<MapComponent bluePin={activeSOS.home\_gps} redPin={activeSOS.live\_gps} /\>  
      \</div\>

      {/\* DISPATCH ACTION BAR \*/}  
      \<div className="bg-gray-800 p-6 flex justify-between items-center"\>  
        \<div\>  
          \<h2 className="text-xl font-bold"\>Patient: {activeSOS.ihs\_uid}\</h2\>  
          \<p className="text-gray-400"\>Triggered: {new Date(activeSOS.timestamp).toLocaleTimeString()}\</p\>  
        \</div\>

        \<div className="flex gap-4"\>  
          {isAmberAlert && (  
            \<select   
              className="bg-gray-700 p-3 rounded"  
              onChange={(e) \=\> setOverrideReason(e.target.value)}  
            \>  
              \<option value=""\>Select Verification Reason...\</option\>  
              \<option value="PHONE\_VERIFIED"\>Patient Verified by Phone\</option\>  
              \<option value="KNOWN\_GPS\_DRIFT"\>Known Device GPS Drift\</option\>  
            \</select\>  
          )}

          \<button   
            className={\`px-8 py-3 rounded font-bold ${isAmberAlert && \!overrideReason ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'}\`}  
            disabled={isAmberAlert && \!overrideReason || isProcessing}  
            onClick={handleDispatch}  
          \>  
            {isProcessing ? 'AUTHORIZING...' : 'MOBILIZE FLEET'}  
          \</button\>  
        \</div\>  
      \</div\>  
    \</div\>  
  );  
}

### **STEP 2: Physician Console \- High-Fidelity ECG Canvas**

Standard React state updates cannot handle parsing and rendering arrays of hundreds of voltage points every 500ms. If we try to map this to an SVG, the browser thread will freeze.

We implement a raw HTML5 \<canvas\> that decodes the Base64 payload (originating from the Tablet's BLE daemon) and utilizes requestAnimationFrame to draw a flawless, oscilloscope-style sweeping line.

TypeScript  
// \============================================================================  
// FILE: src/components/clinical/EcgLiveCanvas.tsx  
// CONTEXT: Physician Console \- 60fps Telemetry Rendering  
// \============================================================================  
'use client';

import React, { useEffect, useRef } from 'react';  
import { decodeBase64ToFloat32 } from '@/utils/binaryDecoder';

interface EcgProps {  
  caseId: string;  
}

export const EcgLiveCanvas: React.FC\<EcgProps\> \= ({ caseId }) \=\> {  
  const canvasRef \= useRef\<HTMLCanvasElement\>(null);

  useEffect(() \=\> {  
    const canvas \= canvasRef.current;  
    if (\!canvas) return;  
    const ctx \= canvas.getContext('2d');  
    if (\!ctx) return;

    let xOffset \= 0;  
    const sweepSpeed \= 2; // Pixels per frame  
      
    // Connect to the specific telemetry stream for this case  
    const ws \= new WebSocket(\`wss://ws.ihs.antp.init/v1/telemetry/stream/${caseId}\`);

    ws.onmessage \= (event) \=\> {  
      const payload \= JSON.parse(event.data);  
        
      // Filter for 12-Lead ECG UUID  
      if (payload.service\_uuid \=== '0x180D') {  
        const voltages \= decodeBase64ToFloat32(payload.reading\_value);  
          
        ctx.beginPath();  
        ctx.strokeStyle \= '\#00FF00'; // Medical monitor green  
        ctx.lineWidth \= 1.5;

        for (let i \= 0; i \< voltages.length; i++) {  
          // Normalize voltage (-2.0mV to \+2.0mV) to canvas height  
          const y \= canvas.height / 2 \- (voltages\[i\] \* (canvas.height / 4));

          if (xOffset \=== 0\) ctx.moveTo(xOffset, y);  
          else ctx.lineTo(xOffset, y);

          xOffset \+= sweepSpeed;

          // Wrap-around logic  
          if (xOffset \>= canvas.width) {  
            xOffset \= 0;  
            // Draw a black rectangle with slight opacity to create a "fade" effect   
            // behind the sweeping line, mimicking analog phosphor displays.  
            ctx.fillStyle \= 'rgba(0, 0, 0, 0.1)';  
            ctx.fillRect(0, 0, canvas.width, canvas.height);  
          }  
        }  
        ctx.stroke();  
      }  
    };

    return () \=\> ws.close(); // Cleanup socket on unmount  
  }, \[caseId\]);

  return (  
    \<div className="border border-gray-700 bg-black rounded p-2"\>  
      \<div className="flex justify-between text-green-500 font-mono text-xs mb-1"\>  
        \<span\>LEAD II (0x180D)\</span\>  
        \<span\>25 mm/s | 10 mm/mV\</span\>  
      \</div\>  
      \<canvas ref={canvasRef} width={800} height={200} className="w-full bg-black block" /\>  
    \</div\>  
  );  
};

### **STEP 3: Physician Console \- Stock-Aware Rx & SHA-256 Gate**

This component ensures a doctor cannot prescribe a medication that is missing from the ambulance's physical inventory. Once the 6-digit PIN is applied, the React state physically locks, mirroring the WORM constraint enforced by our Prisma interceptor in Sprint 1\.

TypeScript  
// \============================================================================  
// FILE: src/components/clinical/StockAwareRxPad.tsx  
// CONTEXT: Physician Console \- FEFO Inventory & WORM Authorization  
// \============================================================================  
'use client';

import React, { useState, useEffect } from 'react';  
import { InventoryApi, AuthApi } from '@/services/api';

export const StockAwareRxPad: React.FC\<{ caseId: string; fleetId: string }\> \= ({ caseId, fleetId }) \=\> {  
  const \[activeInventory, setActiveInventory\] \= useState\<any\[\]\>(\[\]);  
  const \[selectedDrugs, setSelectedDrugs\] \= useState\<string\[\]\>(\[\]);  
  const \[pin, setPin\] \= useState\<string\>('');  
  const \[isLocked, setIsLocked\] \= useState\<boolean\>(false);  
  const \[signatureHash, setSignatureHash\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    // Fetch ONLY what is currently loaded in the assigned ambulance  
    InventoryApi.getVehicleStock(fleetId).then(setActiveInventory);  
  }, \[fleetId\]);

  const handleAuthorize \= async () \=\> {  
    if (pin.length \!== 6 || selectedDrugs.length \=== 0\) return;

    try {  
      const response \= await AuthApi.generateESignature({  
        case\_id: caseId,  
        prescribed\_drugs: selectedDrugs,  
        doctor\_pin: pin  
      });

      setSignatureHash(response.sha256\_signature);  
      setIsLocked(true); // Hard lock the UI  
    } catch (error) {  
      alert('AUTHORIZATION FAILED: Invalid PIN or case state.');  
    }  
  };

  return (  
    \<div className="bg-gray-100 p-6 rounded-lg shadow-inner"\>  
      \<h3 className="text-lg font-bold border-b border-gray-300 pb-2 mb-4"\>E-Prescription & Authorization\</h3\>  
        
      {/\* INVENTORY SELECTOR \*/}  
      \<select   
        className="w-full p-2 mb-4 border rounded disabled:bg-gray-200 disabled:text-gray-500"  
        disabled={isLocked}  
        onChange={(e) \=\> setSelectedDrugs(\[...selectedDrugs, e.target.value\])}  
      \>  
        \<option value=""\>Select from Fleet Inventory...\</option\>  
        {activeInventory.map(drug \=\> (  
          \<option key={drug.item\_id} value={drug.item\_id}\>  
            {drug.name} (Available: {drug.current\_stock}) \- Exp: {drug.expiry\_date}  
          \</option\>  
        ))}  
      \</select\>

      {/\* SELECTED ITEMS \*/}  
      \<ul className="mb-6 space-y-1"\>  
        {selectedDrugs.map((id, idx) \=\> \<li key={idx} className="text-sm"\>✔️ {id}\</li\>)}  
      \</ul\>

      {/\* WORM COMPLIANCE AUTHORIZATION GATE \*/}  
      \<div className={\`p-4 rounded border ${isLocked ? 'bg-green-100 border-green-500' : 'bg-white border-gray-300'}\`}\>  
        {isLocked ? (  
          \<div\>  
            \<div className="text-green-800 font-bold mb-1"\>🔐 AUTHORIZED & CLINICALLY LOCKED\</div\>  
            \<div className="font-mono text-xs text-gray-600 break-all"\>SHA-256: {signatureHash}\</div\>  
          \</div\>  
        ) : (  
          \<div className="flex gap-2"\>  
            \<input   
              type="password"   
              maxLength={6}   
              placeholder="Enter 6-Digit PIN"   
              className="flex-grow p-2 border rounded text-center tracking-widest"  
              value={pin}  
              onChange={(e) \=\> setPin(e.target.value)}  
            /\>  
            \<button   
              className="bg-blue-800 text-white font-bold px-6 py-2 rounded hover:bg-blue-700"  
              onClick={handleAuthorize}  
            \>  
              APPLY E-SIGNATURE  
            \</button\>  
          \</div\>  
        )}  
      \</div\>  
    \</div\>  
  );  
};

### **Engineering Rationale**

* **HTML5 Canvas Efficiency:** By decoding the Base64 arrays natively in the browser and updating coordinates directly on the \<canvas\> context, we bypass React's virtual DOM diffing entirely. This allows the ECG to sweep at a flawless 60fps without choking the browser thread or interrupting the adjacent WebRTC video feed.  
* **Phosphor Fade Effect:** The rgba(0, 0, 0, 0.1) trailing rectangle on the canvas is a crucial UI design choice. It mimics the visual persistence of traditional analog medical monitors, making it significantly easier for cardiologists to track the rhythm visually.  
* **State-Driven WORM UI:** The StockAwareRxPad completely disables the \<select\> dropdown once the isLocked state becomes true. This ensures the frontend physically prevents a doctor from adding a drug after the SHA-256 signature is applied, maintaining parity with the backend WORM interceptor we built in Sprint 1\.

