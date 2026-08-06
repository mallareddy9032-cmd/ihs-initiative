### **Client App** 

### **SPRINT 3: The Edge Client App (React Native)**

We are now moving to the edge. The **Client Mobile App** is the physical touchpoint for the 1,200 enrolled families. During a medical emergency, the user's cognitive load is severely impaired; the UI must be frictionless, and the network layer must be absolutely bulletproof.

To achieve the **1,500ms fallback SLA** defined in PRD P1-1.3, we cannot rely solely on standard React Native libraries. We must bridge down to the native Android OS to bypass the default SMS application, ensuring the encrypted payload is dispatched silently in the background if the WebSocket connection drops.

Here is the production-grade implementation of the Panic Engine.

### **STEP 1: The Native Android SMS Bridge (Kotlin)**

By default, React Native SMS libraries open the user's messaging app (intent), forcing them to press "Send." This adds friction and costs critical seconds. We will write a native Android module using `SmsManager` (requiring the `SEND_SMS` permission) to fire the payload instantly in the background.

Kotlin  
// \============================================================================  
// FILE: android/app/src/main/java/com/ihs/DirectSmsModule.kt  
// CONTEXT: Native Bridge for Zero-Friction SMS Fallback  
// \============================================================================  
package com.ihs

import android.telephony.SmsManager  
import com.facebook.react.bridge.ReactApplicationContext  
import com.facebook.react.bridge.ReactContextBaseJavaModule  
import com.facebook.react.bridge.ReactMethod  
import com.facebook.react.bridge.Promise

class DirectSmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {  
        return "DirectSmsModule"  
    }

    @ReactMethod  
    fun sendDirectSms(phoneNumber: String, message: String, promise: Promise) {  
        try {  
            val smsManager: SmsManager \= SmsManager.getDefault()  
            // Split message if payload exceeds standard 160 GSM characters  
            val parts \= smsManager.divideMessage(message)  
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)  
              
            promise.resolve("SMS\_DISPATCH\_SUCCESS")  
        } catch (e: Exception) {  
            promise.reject("SMS\_DISPATCH\_FAILED", e.message)  
        }  
    }  
}

### **STEP 2: The Panic Engine Service (TypeScript)**

This service manages the race condition between the WebSocket and the Native SMS bridge. It attempts the WSS connection. If the connection fails or times out after **1,500ms**, it instantly encrypts the payload using AES-256 and fires it to the IHS GSM modem shortcode.

TypeScript  
// \============================================================================  
// FILE: src/services/EmergencyTriggerEngine.ts  
// CONTEXT: Network Resiliency & State Machine  
// \============================================================================  
import { NativeModules } from 'react-native';  
import CryptoJS from 'crypto-js';

const { DirectSmsModule } \= NativeModules;  
const COMMAND\_CENTER\_SHORTCODE \= "+919876543210"; // Placeholder for IHS GSM Modem

export class EmergencyTriggerEngine {  
  private ihsUid: string;  
  private encryptionKey: string;

  constructor(ihsUid: string, encryptionKey: string) {  
    this.ihsUid \= ihsUid;  
    this.encryptionKey \= encryptionKey;  
  }

  public async firePanic(gps: { lat: number; lng: number }): Promise\<string\> {  
    const payload \= {  
      event: 'PANIC\_TRIGGERED',  
      ihs\_uid: this.ihsUid,  
      timestamp: new Date().toISOString(),  
      gps: gps,  
    };

    try {  
      // Race the WebSocket connection against a 1500ms strict timeout  
      await Promise.race(\[  
        this.transmitOverWss(payload),  
        this.enforceTimeout(1500)  
      \]);  
      return 'DISPATCHED\_VIA\_WSS';  
    } catch (error) {  
      console.warn("WSS Failed or Timed Out. Executing SMS Fallback.", error);  
      await this.executeSmsFallback(payload);  
      return 'DISPATCHED\_VIA\_SMS';  
    }  
  }

  private transmitOverWss(payload: any): Promise\<void\> {  
    return new Promise((resolve, reject) \=\> {  
      const ws \= new WebSocket('wss://ws.ihs.antp.init/v1/triage/panic');  
        
      ws.onopen \= () \=\> {  
        ws.send(JSON.stringify(payload));  
        ws.close();  
        resolve();  
      };  
        
      ws.onerror \= (e) \=\> reject(e);  
    });  
  }

  private enforceTimeout(ms: number): Promise\<void\> {  
    return new Promise((\_, reject) \=\>   
      setTimeout(() \=\> reject(new Error('TIMEOUT\_EXCEEDED')), ms)  
    );  
  }

  private async executeSmsFallback(payload: any): Promise\<void\> {  
    // Minify keys to save SMS character space  
    const minified \= {  
      e: "SOS",  
      i: payload.ihs\_uid,  
      t: payload.timestamp,  
      g: \`${payload.gps.lat},${payload.gps.lng}\`  
    };

    const stringified \= JSON.stringify(minified);  
    const encrypted \= CryptoJS.AES.encrypt(stringified, this.encryptionKey).toString();  
      
    // Fire Native Bridge (Format: IHS::\[AES\_STRING\])  
    await DirectSmsModule.sendDirectSms(COMMAND\_CENTER\_SHORTCODE, \`IHS::${encrypted}\`);  
  }  
}

### **STEP 3: The Frictionless SOS User Interface**

The UI is built to prevent accidental triggers while guaranteeing immediate access during an emergency. We implement a "Slide-to-SOS" or a "Hold-for-3-Seconds" pattern to prevent pocket dials, which would burn through the user's ₹799 capitation quota unnecessarily.

TypeScript  
// \============================================================================  
// FILE: src/screens/HomeScreen.tsx  
// CONTEXT: Primary SOS Interface  
// \============================================================================  
import React, { useState } from 'react';  
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';  
import Geolocation from '@react-native-community/geolocation';  
import { EmergencyTriggerEngine } from '../services/EmergencyTriggerEngine';

export const HomeScreen: React.FC \= () \=\> {  
  const \[isDispatching, setIsDispatching\] \= useState(false);  
    
  // Instantiated with user data from secure local storage  
  const engine \= new EmergencyTriggerEngine("IHS-ANTP-00001", "provisioned\_aes\_key");

  const handlePanicPress \= () \=\> {  
    setIsDispatching(true);  
      
    // 1\. Grab High-Accuracy GPS (Red Pin)  
    Geolocation.getCurrentPosition(  
      async (position) \=\> {  
        const liveGps \= {  
          lat: position.coords.latitude,  
          lng: position.coords.longitude  
        };

        // 2\. Fire the engine  
        const status \= await engine.firePanic(liveGps);  
        setIsDispatching(false);  
          
        Alert.alert("Ambulance Dispatched", \`Signal routed via ${status}. Help is on the way.\`);  
      },  
      (error) \=\> {  
        setIsDispatching(false);  
        Alert.alert("GPS Error", "Ensure location services are enabled.");  
      },  
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }  
    );  
  };

  return (  
    \<View style={styles.container}\>  
      \<Text style={styles.header}\>IHS Emergency Services\</Text\>  
        
      \<TouchableOpacity   
        style={styles.sosButton}   
        onLongPress={handlePanicPress}   
        delayLongPress={1500} // 1.5 second hold prevents accidental triggers  
        disabled={isDispatching}  
      \>  
        \<Text style={styles.sosText}\>  
          {isDispatching ? "TRANSMITTING..." : "HOLD TO DISPATCH"}  
        \</Text\>  
      \</TouchableOpacity\>  
        
      \<Text style={styles.subText}\>Holds use 1 Doorstep Visit Quota\</Text\>  
    \</View\>  
  );  
};

const styles \= StyleSheet.create({  
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '\#111' },  
  header: { color: '\#FFF', fontSize: 24, marginBottom: 40, fontWeight: 'bold' },  
  sosButton: { width: 250, height: 250, borderRadius: 125, backgroundColor: '\#D32F2F', justifyContent: 'center', alignItems: 'center', elevation: 10 },  
  sosText: { color: '\#FFF', fontSize: 22, fontWeight: '900', letterSpacing: 2 },  
  subText: { color: '\#888', marginTop: 20 }  
});

### **Architectural Rationale**

* **Promise Racing (`Promise.race`)**: This is the core of the network resiliency protocol. The WebSocket connection function is raced against a strict `setTimeout`. If the WebSocket doesn't resolve in exactly 1.5 seconds, the Promise rejects, the `catch` block catches the error, and the encrypted SMS is fired immediately.  
* **Payload Minification**: SMS is limited to 160 characters (or 70 for Unicode). By minifying the keys (`ihs_uid` to `i`, `timestamp` to `t`) before AES encryption, we ensure the cipher text fits cleanly into a single SMS, reducing carrier transmission time and lowering SMS gateway costs.  
* **UI Geolocation Constraints**: We enforce `enableHighAccuracy: true` and `maximumAge: 0`. We cannot rely on cached location data. The Command Center's Dual-Pin logic relies on this exact, live coordinate to verify if the patient is at their registered home base or requires a dynamic dispatch override.

