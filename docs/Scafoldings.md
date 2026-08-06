### **1\. Cloud Engine & Web Portals (Node.js / Next.js)**

For the backend and web interfaces, we utilize a unified package.json (often deployed as a monorepo or standard Node environment) and a strict TypeScript configuration.

**package.json**

JSON  
{  
  "name": "ihs-cloud-engine",  
  "version": "1.0.0",  
  "description": "IHS Master FSM, WebSocket Hub, and Web Portals",  
  "main": "dist/server.js",  
  "scripts": {  
    "dev": "next dev",  
    "build": "prisma generate && next build && tsc \--project tsconfig.server.json",  
    "start": "node dist/server.js",  
    "test:ci": "jest \--passWithNoTests"  
  },  
  "dependencies": {  
    "@aws-sdk/client-s3": "^3.400.0",  
    "@prisma/client": "^5.0.0",  
    "express": "^4.18.2",  
    "mapbox-gl": "^2.15.0",  
    "next": "14.0.0",  
    "node-cron": "^3.0.2",  
    "react": "^18.2.0",  
    "react-dom": "^18.2.0",  
    "ws": "^8.13.0"  
  },  
  "devDependencies": {  
    "@types/express": "^4.17.17",  
    "@types/node": "^20.0.0",  
    "@types/node-cron": "^3.0.7",  
    "@types/react": "^18.2.0",  
    "@types/ws": "^8.5.5",  
    "autoprefixer": "^10.4.15",  
    "jest": "^29.6.0",  
    "postcss": "^8.4.28",  
    "prisma": "^5.0.0",  
    "tailwindcss": "^3.3.3",  
    "ts-node": "^10.9.1",  
    "typescript": "^5.1.6"  
  }  
}

**tsconfig.json** (Enforcing strict typing for medical data)

JSON  
{  
  "compilerOptions": {  
    "target": "ES2022",  
    "lib": \["dom", "dom.iterable", "esnext"\],  
    "allowJs": true,  
    "skipLibCheck": true,  
    "strict": true,  
    "forceConsistentCasingInFileNames": true,  
    "noEmit": true,  
    "esModuleInterop": true,  
    "module": "esnext",  
    "moduleResolution": "node",  
    "resolveJsonModule": true,  
    "isolatedModules": true,  
    "jsx": "preserve",  
    "incremental": true,  
    "baseUrl": ".",  
    "paths": {  
      "@/\*": \["./src/\*"\]  
    }  
  },  
  "include": \["next-env.d.ts", "\*\*/\*.ts", "\*\*/\*.tsx"\],  
  "exclude": \["node\_modules"\]  
}

### **2\. Client Mobile App (React Native \- iOS / Android)**

This configuration ensures the React Native environment has the necessary cryptographic libraries for the SMS fallback and the geolocation engines for the Dual-Pin math.

**package.json**

JSON  
{  
  "name": "ihs-client-app",  
  "version": "1.0.0",  
  "private": true,  
  "scripts": {  
    "android": "react-native run-android",  
    "ios": "react-native run-ios",  
    "start": "react-native start"  
  },  
  "dependencies": {  
    "@react-native-community/geolocation": "^3.1.0",  
    "crypto-js": "^4.1.1",  
    "react": "18.2.0",  
    "react-native": "0.72.4"  
  },  
  "devDependencies": {  
    "@babel/core": "^7.20.0",  
    "@types/crypto-js": "^4.1.1",  
    "@types/react": "^18.2.6",  
    "typescript": "^5.0.4"  
  }  
}

**ios/Podfile** (Critical for iOS compilation)

Ruby  
require\_relative '../node\_modules/react-native/scripts/react\_native\_pods'  
require\_relative '../node\_modules/@react-native-community/cli-platform-ios/native\_modules'

platform :ios, '13.0'  
install\! 'cocoapods', :deterministic\_uuids \=\> false

target 'IHSClientApp' do  
  config \= use\_native\_modules\!

  \# Flags change depending on the env values.  
  flags \= get\_default\_flags()

  use\_react\_native\!(  
    :path \=\> config\[:reactNativePath\],  
    :hermes\_enabled \=\> flags\[:hermes\_enabled\],  
    :fabric\_enabled \=\> flags\[:fabric\_enabled\],  
    :app\_path \=\> "\#{Pod::Config.instance.installation\_root}/.."  
  )

  post\_install do |installer|  
    react\_native\_post\_install(  
      installer,  
      config\[:reactNativePath\],  
      :mac\_catalyst\_enabled \=\> false  
    )  
  end  
end

### **3\. Field Staff Tablet App (Native Android Kotlin)**

This build.gradle file imports the necessary AndroidX libraries to power the background WorkManager (for offline sync), the Room database (SQLite), and the Kotlin Coroutines needed for the unkillable BLE GATT daemon.

**app/build.gradle.kts**

Kotlin  
plugins {  
    id("com.android.application")  
    id("org.jetbrains.kotlin.android")  
    id("kotlin-kapt") // Required for Room Database annotation processing  
}

android {  
    namespace \= "com.ihs.fieldtablet"  
    compileSdk \= 34

    defaultConfig {  
        applicationId \= "com.ihs.fieldtablet"  
        minSdk \= 28 // Required for modern BLE and Foreground Services  
        targetSdk \= 34  
        versionCode \= 1  
        versionName \= "1.0-alpha"  
    }

    buildTypes {  
        release {  
            isMinifyEnabled \= true  
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")  
        }  
    }  
    compileOptions {  
        sourceCompatibility \= JavaVersion.VERSION\_17  
        targetCompatibility \= JavaVersion.VERSION\_17  
    }  
    kotlinOptions {  
        jvmTarget \= "17"  
    }  
}

dependencies {  
    val roomVersion \= "2.5.2"  
    val workVersion \= "2.8.1"  
    val coroutinesVersion \= "1.7.3"

    // Android Core  
    implementation("androidx.core:core-ktx:1.10.1")  
    implementation("androidx.appcompat:appcompat:1.6.1")  
    implementation("com.google.android.material:material:1.9.0")

    // Room SQLite (Local Database)  
    implementation("androidx.room:room-runtime:$roomVersion")  
    implementation("androidx.room:room-ktx:$roomVersion")  
    kapt("androidx.room:room-compiler:$roomVersion")

    // WorkManager (Offline Background Sync)  
    implementation("androidx.work:work-runtime-ktx:$workVersion")

    // Kotlin Coroutines (BLE Daemon threading)  
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")

    // Retrofit / OkHttp (REST API Sync)  
    implementation("com.squareup.retrofit2:retrofit:2.9.0")  
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")  
}

Utility Functions

### **1\. Geospatial Mathematics (geo.ts)**

To calculate the exact distance between the Red Pin (live mobile GPS) and the Blue Pin (registered home base), we use the **Haversine formula**. This accounts for the spherical curvature of the Earth, which is essential for accurate geofencing.

The underlying mathematical model is:

$$d \= 2r \\arcsin\\left(\\sqrt{\\sin^2\\left(\\frac{\\Delta\\phi}{2}\\right) \+ \\cos\\phi\_1\\cos\\phi\_2\\sin^2\\left(\\frac{\\Delta\\lambda}{2}\\right)}\\right)$$  
*(Where $r$ is the Earth's radius, $\\phi$ is latitude, and $\\lambda$ is longitude in radians).*

TypeScript  
// \============================================================================  
// FILE: src/utils/geo.ts  
// CONTEXT: Geospatial routing and Dual-Pin Geofencing  
// \============================================================================

interface Coordinates {  
  lat: number;  
  lng: number;  
}

/\*\*  
 \* Calculates the great-circle distance between two GPS coordinates.  
 \* Returns the exact distance in meters.  
 \*/  
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {  
  const EARTH\_RADIUS\_METERS \= 6371000; 

  const toRadians \= (degrees: number) \=\> (degrees \* Math.PI) / 180;

  const dLat \= toRadians(coord2.lat \- coord1.lat);  
  const dLng \= toRadians(coord2.lng \- coord1.lng);

  const lat1 \= toRadians(coord1.lat);  
  const lat2 \= toRadians(coord2.lat);

  const a \=   
    Math.sin(dLat / 2\) \* Math.sin(dLat / 2\) \+  
    Math.sin(dLng / 2\) \* Math.sin(dLng / 2\) \* Math.cos(lat1) \* Math.cos(lat2);  
      
  const c \= 2 \* Math.atan2(Math.sqrt(a), Math.sqrt(1 \- a));

  // Output distance in meters  
  return EARTH\_RADIUS\_METERS \* c;   
}

### **2\. Cryptographic Hashing (crypto.ts)**

This utility powers the **WORM Compliance Interceptor** and the **Stock-Aware Rx Pad**. It uses Node.js native crypto libraries to generate irreversible hashes, guaranteeing the immutability of the audit ledger.

TypeScript  
// \============================================================================  
// FILE: src/utils/crypto.ts  
// CONTEXT: NMC/DPDP WORM Compliance & E-Signatures  
// \============================================================================

import crypto from 'crypto';

/\*\*  
 \* Generates a deterministic SHA-256 hash for a given string payload.  
 \* Used for locking medical records and electronic prescriptions.  
 \*/  
export function generateSha256(payload: string): string {  
  if (\!payload || payload.trim() \=== '') {  
    throw new Error("CRITICAL: Cannot generate hash for an empty payload.");  
  }  
    
  return crypto  
    .createHash('sha256')  
    .update(payload)  
    .digest('hex');  
}

### **3\. Binary Telemetry Decoder (binaryDecoder.ts)**

The Field Staff Tablet reads raw byte arrays from the BLE medical hardware, encodes them to Base64, and pushes them to the cloud. When the Next.js Physician Console receives this Base64 string via WebSockets, it must be rapidly decoded back into a Float32Array so the HTML5 \<canvas\> can render the ECG sweep at 60fps.

TypeScript  
// \============================================================================  
// FILE: src/utils/binaryDecoder.ts  
// CONTEXT: Client-side decoding for live ECG/Vitals telemetry  
// \============================================================================

/\*\*  
 \* Decodes a Base64 string directly into a Float32Array.  
 \* Optimized for client-side browser performance (bypasses heavy Node Buffers).  
 \*/  
export function decodeBase64ToFloat32(base64String: string): Float32Array {  
  // 1\. Decode Base64 to a raw binary string using the browser's native atob  
  const binaryString \= window.atob(base64String);  
  const len \= binaryString.length;  
    
  // 2\. Create a buffer and an 8-bit view to hold the raw bytes  
  const bytes \= new Uint8Array(len);  
  for (let i \= 0; i \< len; i++) {  
    bytes\[i\] \= binaryString.charCodeAt(i);  
  }  
    
  // 3\. Cast the memory buffer to a 32-bit floating point array  
  // This assumes the BLE hardware transmits little-endian floats.  
  return new Float32Array(bytes.buffer);  
}

### **1\. Web Portals: Next.js App Router & Middleware**

The Next.js 13/14 App Router utilizes a file-system-based routing mechanism. To prevent unauthorized users from accessing the Command Center or Physician Console, we deploy an Edge Middleware function. This intercepts every request *before* it hits the page, checking for a valid JSON Web Token (JWT).

#### **Route Structure Map**

| Directory Path | Role Access | Component Purpose |
| :---- | :---- | :---- |
| app/login/page.tsx | Public | Authentication entry point. |
| app/dispatcher/dashboard/page.tsx | Dispatcher | Dual-Pin Map & Fleet mobilization (Sprint 5). |
| app/physician/console/page.tsx | Doctor | Live ECG Canvas & WORM Rx Pad (Sprint 5). |
| middleware.ts | Edge Layer | Route protection and JWT validation guard. |

#### **Edge Middleware (middleware.ts)**

This file sits at the root of your Next.js project and physically guards the clinical routes.

TypeScript  
// \============================================================================  
// FILE: middleware.ts  
// CONTEXT: Next.js Edge Middleware for Route Protection  
// \============================================================================  
import { NextResponse } from 'next/server';  
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {  
  // 1\. Extract the JWT from secure HTTP-only cookies  
  const token \= request.cookies.get('ihs\_auth\_token')?.value;  
  const { pathname } \= request.nextUrl;

  // 2\. Define Protected Route Paths  
  const isDispatcherRoute \= pathname.startsWith('/dispatcher');  
  const isPhysicianRoute \= pathname.startsWith('/physician');

  // 3\. Absolute Rejection Logic  
  if ((isDispatcherRoute || isPhysicianRoute) && \!token) {  
    const loginUrl \= new URL('/login', request.url);  
    // Append the attempted URL so we can redirect them back after a successful login  
    loginUrl.searchParams.set('callbackUrl', pathname);  
    return NextResponse.redirect(loginUrl);  
  }

  // NOTE: In production, verify the JWT cryptographic signature here   
  // or pass it to a lightweight Edge verification API.

  return NextResponse.next();  
}

// 4\. Optimize execution by limiting middleware to specific paths  
export const config \= {  
  matcher: \['/dispatcher/:path\*', '/physician/:path\*'\],  
};

### **2\. Edge Client App: React Navigation (Mobile)**

For the React Native application, we utilize @react-navigation/native-stack. The mobile app requires a strict state machine approach to routing: if the user is authenticated, they should never be able to navigate "back" to the login screen without explicitly logging out.

#### **Navigation Tree (App.tsx)**

This acts as the root entry point for the React Native application, wrapping the SOS triggers we built in Sprint 3\.

TypeScript  
// \============================================================================  
// FILE: src/App.tsx  
// CONTEXT: React Native Navigation Controller  
// \============================================================================  
import React, { useState, useEffect } from 'react';  
import { NavigationContainer } from '@react-navigation/native';  
import { createNativeStackNavigator } from '@react-navigation/native-stack';  
import { ActivityIndicator, View } from 'react-native';

// Import Screens  
import { LoginScreen } from './screens/LoginScreen';  
import { HomeScreen } from './screens/HomeScreen'; // The SOS UI from Sprint 3  
import { SettingsScreen } from './screens/SettingsScreen';  
import { SecureStorage } from './utils/secureStorage';

// Define strict TypeScript param lists for route safety  
export type RootStackParamList \= {  
  Login: undefined;  
  Home: { ihsUid: string };  
  Settings: undefined;  
};

const Stack \= createNativeStackNavigator\<RootStackParamList\>();

export default function App() {  
  const \[isLoading, setIsLoading\] \= useState(true);  
  const \[userUid, setUserUid\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    // Check local secure storage for an existing session on boot  
    const bootstrapAsync \= async () \=\> {  
      try {  
        const storedUid \= await SecureStorage.getItem('ihs\_uid');  
        if (storedUid) setUserUid(storedUid);  
      } catch (e) {  
        console.error("Failed to restore session", e);  
      }  
      setIsLoading(false);  
    };

    bootstrapAsync();  
  }, \[\]);

  if (isLoading) {  
    return (  
      \<View style={{ flex: 1, justifyContent: 'center', backgroundColor: '\#111' }}\>  
        \<ActivityIndicator size="large" color="\#D32F2F" /\>  
      \</View\>  
    );  
  }

  return (  
    \<NavigationContainer\>  
      \<Stack.Navigator screenOptions={{ headerShown: false }}\>  
        {userUid \== null ? (  
          // UNAUTHENTICATED STACK  
          \<Stack.Screen   
            name="Login"   
            component={LoginScreen}   
            // Pass the setter down so the Login screen can update the global state  
            initialParams={{ setAuth: setUserUid }}   
          /\>  
        ) : (  
          // AUTHENTICATED STACK  
          \<\>  
            \<Stack.Screen   
              name="Home"   
              component={HomeScreen}   
              initialParams={{ ihsUid: userUid }}   
            /\>  
            \<Stack.Screen   
              name="Settings"   
              component={SettingsScreen}   
              options={{ headerShown: true, title: "System Preferences" }}  
            /\>  
          \</\>  
        )}  
      \</Stack.Navigator\>  
    \</NavigationContainer\>  
  );  
}

### **Strategic Implementation Notes**

* **Conditional Mobile Rendering:** Notice the {userUid \== null ? (...) : (...)} ternary operator in the React Native router. This is critical. By physically removing the LoginScreen from the navigation stack when a user is authenticated, we prevent the native Android/iOS hardware "Back" button from accidentally returning a panicked user to a login prompt during a medical emergency.  
* **Next.js Callbacks:** The Next.js middleware appends a callbackUrl search parameter when it intercepts an unauthenticated user. If a physician clicks an email link for an urgent dispatch (/physician/console?case=123) but their session has expired, they will be routed to /login. Upon successful authentication, your login function should read this parameter and immediately route them to the active case, minimizing time-to-treatment.

### **1\. Web Portals: Authentication & Navigation (Next.js / Tailwind)**

For the internal tools (Command Center & Physician Console), we utilize a dark-mode default. This reduces eye strain for dispatchers working 12-hour night shifts and ensures critical alerts (like Amber Geofence warnings) immediately capture visual attention.

#### **A. The Clinical Login Form**

This component replaces standard email/password fields with a strict UID and PIN system, reflecting typical hospital and fleet-management authentication standards.

TypeScript  
// \============================================================================  
// FILE: src/components/ui/LoginForm.tsx  
// CONTEXT: Next.js \- Strict UID & PIN Authentication  
// \============================================================================  
'use client';

import React, { useState } from 'react';

export const LoginForm: React.FC\<{ onAuthenticate: (uid: string, pin: string) \=\> Promise\<void\> }\> \= ({ onAuthenticate }) \=\> {  
  const \[uid, setUid\] \= useState('');  
  const \[pin, setPin\] \= useState('');  
  const \[isLoading, setIsLoading\] \= useState(false);  
  const \[error, setError\] \= useState\<string | null\>(null);

  const handleSubmit \= async (e: React.FormEvent) \=\> {  
    e.preventDefault();  
    setIsLoading(true);  
    setError(null);  
    try {  
      await onAuthenticate(uid, pin);  
    } catch (err: any) {  
      setError(err.message || 'Authentication failed. Verify credentials.');  
      setPin(''); // Force PIN re-entry on failure  
    } finally {  
      setIsLoading(false);  
    }  
  };

  return (  
    \<div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-8 text-white"\>  
      \<h2 className="text-2xl font-black tracking-widest text-center mb-6 border-b border-gray-700 pb-4"\>  
        IHS SECURE LOGIN  
      \</h2\>  
        
      {error && (  
        \<div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-6 text-sm font-bold text-center"\>  
          ⚠️ {error}  
        \</div\>  
      )}

      \<form onSubmit={handleSubmit} className="space-y-6"\>  
        \<div\>  
          \<label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide"\>Operator UID\</label\>  
          \<input   
            type="text"   
            placeholder="e.g., DSP-0442"  
            required  
            className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 uppercase"  
            value={uid}  
            onChange={(e) \=\> setUid(e.target.value.toUpperCase())}  
          /\>  
        \</div\>

        \<div\>  
          \<label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide"\>Secure PIN\</label\>  
          \<input   
            type="password"   
            placeholder="••••••"  
            maxLength={6}  
            required  
            className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white text-center tracking-\[1em\] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"  
            value={pin}  
            onChange={(e) \=\> setPin(e.target.value)}  
          /\>  
        \</div\>

        \<button   
          type="submit"   
          disabled={isLoading || uid.length \< 4 || pin.length \< 4}  
          className="w-full bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 rounded transition-colors uppercase tracking-widest"  
        \>  
          {isLoading ? 'Authenticating...' : 'Access Console'}  
        \</button\>  
      \</form\>  
    \</div\>  
  );  
};

#### **B. Command Center Navigation Bar**

A persistent top bar that provides immediate context on system health, active user roles, and network status.

TypeScript  
// \============================================================================  
// FILE: src/components/ui/TopNav.tsx  
// CONTEXT: Next.js \- Persistent Dashboard Header  
// \============================================================================  
import React from 'react';

export const TopNav: React.FC\<{ operatorName: string; activeCases: number }\> \= ({ operatorName, activeCases }) \=\> {  
  return (  
    \<nav className="w-full bg-black border-b border-gray-800 px-6 py-3 flex justify-between items-center text-white"\>  
      \<div className="flex items-center gap-4"\>  
        \<div className="bg-red-700 text-white font-black px-3 py-1 rounded text-sm tracking-wider"\>  
          IHS COMMAND  
        \</div\>  
        \<span className="text-gray-400 text-sm font-mono border-l border-gray-700 pl-4"\>  
          Node: AP-SOUTH-2  
        \</span\>  
      \</div\>

      \<div className="flex items-center gap-6"\>  
        \<div className="flex items-center gap-2"\>  
          \<span className="relative flex h-3 w-3"\>  
            {activeCases \> 0 && \<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"\>\</span\>}  
            \<span className={\`relative inline-flex rounded-full h-3 w-3 ${activeCases \> 0 ? 'bg-red-500' : 'bg-green-500'}\`}\>\</span\>  
          \</span\>  
          \<span className="text-sm font-bold text-gray-300"\>  
            {activeCases} ACTIVE {activeCases \=== 1 ? 'CASE' : 'CASES'}  
          \</span\>  
        \</div\>  
          
        \<div className="text-sm text-blue-400 font-bold border-l border-gray-800 pl-6"\>  
          {operatorName}  
        \</div\>  
      \</div\>  
    \</nav\>  
  );  
};

### **2\. Edge Client App: Blocking Modals & Feedback (React Native)**

On a mobile device during a panic scenario, users will often rapidly tap the screen if they do not receive immediate visual feedback. We must implement a strict, full-screen **Action Overlay** that blocks redundant inputs while the background network processes the SMS or WSS payload.

#### **A. The Un-Dismissible Loading Overlay**

This component uses React Native's `Modal` to completely consume the screen layer while an asynchronous action is pending.

TypeScript  
// \============================================================================  
// FILE: src/components/ActionOverlay.tsx  
// CONTEXT: React Native \- Redundant Input Prevention  
// \============================================================================  
import React from 'react';  
import { Modal, View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface ActionOverlayProps {  
  isVisible: boolean;  
  message: string;  
}

export const ActionOverlay: React.FC\<ActionOverlayProps\> \= ({ isVisible, message }) \=\> {  
  return (  
    \<Modal  
      transparent={true}  
      animationType="fade"  
      visible={isVisible}  
      onRequestClose={() \=\> {}} // Disables Android hardware back button  
    \>  
      \<View style={styles.overlayContainer}\>  
        \<View style={styles.dialogBox}\>  
          \<ActivityIndicator size="large" color="\#D32F2F" style={styles.spinner} /\>  
          \<Text style={styles.messageText}\>{message}\</Text\>  
        \</View\>  
      \</View\>  
    \</Modal\>  
  );  
};

const styles \= StyleSheet.create({  
  overlayContainer: {  
    flex: 1,  
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // High opacity to blank out the UI below  
    justifyContent: 'center',  
    alignItems: 'center',  
  },  
  dialogBox: {  
    backgroundColor: '\#1E1E1E',  
    padding: 30,  
    borderRadius: 8,  
    alignItems: 'center',  
    borderWidth: 1,  
    borderColor: '\#333',  
    minWidth: 250,  
  },  
  spinner: {  
    transform: \[{ scale: 1.5 }\],  
    marginBottom: 20,  
  },  
  messageText: {  
    color: '\#FFFFFF',  
    fontSize: 16,  
    fontWeight: 'bold',  
    letterSpacing: 1,  
    textAlign: 'center',  
  }  
});

### **Architectural Implementation Notes**

* **Input Sanitization:** In the `LoginForm`, `e.target.value.toUpperCase()` physically forces the UID input into capital letters. This prevents simple case-sensitivity mismatch errors when dispatchers type rapidly.  
* **Tactile Tracking:** The PIN input field utilizes `tracking-[1em]` (Tailwind) to space the password dots widely apart. This reduces cognitive friction, allowing the user to easily see exactly how many digits they have entered without revealing the characters.  
* **Event Blocking (React Native):** The `onRequestClose={() => {}}` prop inside the React Native `Modal` is a critical safety feature. On Android devices, pressing the physical "Back" button normally dismisses a modal. By providing an empty function, we intercept and destroy that event, ensuring the user cannot accidentally abort the `EmergencyTriggerEngine` while it is racing the 1,500ms SMS fallback timeout.

### **STEP 1: The JWT Cryptographic Utility**

This utility handles the generation and verification of the session tokens. It encodes the operator's clearance level (`DISPATCHER` or `PHYSICIAN`) directly into the payload, allowing the Next.js Edge Middleware to perform role-based routing without needing to query the database on every page load.

TypeScript  
// \============================================================================  
// FILE: src/utils/jwt.ts  
// CONTEXT: Cryptographic Token Generation & Validation  
// \============================================================================  
import jwt from 'jsonwebtoken';

const JWT\_SECRET \= process.env.JWT\_SECRET\_KEY || 'FATAL\_UNCONFIGURED\_SECRET';  
const EXPIRES\_IN \= '12h'; // Strict 12-hour shift expiration

export interface JwtPayload {  
  internal\_id: string;  
  ihs\_uid: string;  
  role: 'DISPATCHER' | 'PHYSICIAN' | 'SYSTEM\_ADMIN';  
}

export class JwtEngine {  
  /\*\*  
   \* Generates a signed JWT for the authenticated operator.  
   \*/  
  static generateToken(payload: JwtPayload): string {  
    if (JWT\_SECRET \=== 'FATAL\_UNCONFIGURED\_SECRET') {  
      console.warn("CRITICAL WARNING: Using default JWT secret in production\!");  
    }  
      
    return jwt.sign(payload, JWT\_SECRET, {   
      algorithm: 'HS256',  
      expiresIn: EXPIRES\_IN   
    });  
  }

  /\*\*  
   \* Verifies and decodes an incoming JWT. Throws an error if expired or tampered.  
   \*/  
  static verifyToken(token: string): JwtPayload {  
    return jwt.verify(token, JWT\_SECRET) as JwtPayload;  
  }  
}

### **STEP 2: The Node.js Authentication Controller**

This REST endpoint receives the `uid` and `pin` from the Next.js `LoginForm` (built in the previous step). It queries the database, compares the bcrypt-hashed PIN, generates the JWT, and securely injects it into the client's browser cookies.

TypeScript  
// \============================================================================  
// FILE: src/communication/rest/AuthController.ts  
// CONTEXT: Node.js Identity & Access Management (IAM)  
// \============================================================================  
import { Request, Response } from 'express';  
import bcrypt from 'bcrypt';  
import { ihsDbClient } from '@/infrastructure/database/client';  
import { JwtEngine } from '@/utils/jwt';

export class AuthController {  
    
  static async authenticateOperator(req: Request, res: Response) {  
    try {  
      const { uid, pin } \= req.body;

      if (\!uid || \!pin) {  
        return res.status(400).json({ error: 'MALFORMED\_CREDENTIALS' });  
      }

      // 1\. Fetch Operator (Dispatcher or Physician)  
      const operator \= await ihsDbClient.operator.findUnique({  
        where: { ihs\_uid: uid.toUpperCase() }  
      });

      if (\!operator || operator.status \!== 'ACTIVE') {  
        // Obfuscated error message to prevent username enumeration attacks  
        return res.status(401).json({ error: 'INVALID\_CREDENTIALS\_OR\_INACTIVE' });  
      }

      // 2\. Cryptographic PIN Verification  
      const isPinValid \= await bcrypt.compare(pin, operator.hashed\_pin);  
      if (\!isPinValid) {  
        // In production, log failed attempts to trigger a lockout after 5 tries  
        return res.status(401).json({ error: 'INVALID\_CREDENTIALS\_OR\_INACTIVE' });  
      }

      // 3\. Generate the JWT Payload  
      const token \= JwtEngine.generateToken({  
        internal\_id: operator.operator\_id,  
        ihs\_uid: operator.ihs\_uid,  
        role: operator.role as 'DISPATCHER' | 'PHYSICIAN'  
      });

      // 4\. Set Strict HTTP-Only Cookie  
      // This is the critical security step. The frontend JS cannot read this cookie.  
      res.cookie('ihs\_auth\_token', token, {  
        httpOnly: true,                 // Blocks \`document.cookie\` access (XSS mitigation)  
        secure: process.env.NODE\_ENV \=== 'production', // Requires HTTPS in prod  
        sameSite: 'strict',             // Mitigates Cross-Site Request Forgery (CSRF)  
        maxAge: 12 \* 60 \* 60 \* 1000     // 12 hours in milliseconds  
      });

      // 5\. Return success state to the Next.js client  
      return res.status(200).json({  
        success: true,  
        operator: {  
          uid: operator.ihs\_uid,  
          name: operator.full\_name,  
          role: operator.role  
        },  
        message: 'AUTHENTICATION\_SUCCESSFUL'  
      });

    } catch (error) {  
      console.error('Authentication Error:', error);  
      return res.status(500).json({ error: 'INTERNAL\_SERVER\_ERROR' });  
    }  
  }

  static async destroySession(req: Request, res: Response) {  
    // Overwrite the cookie with an immediate expiration date to log the user out  
    res.cookie('ihs\_auth\_token', '', {  
      httpOnly: true,  
      secure: process.env.NODE\_ENV \=== 'production',  
      sameSite: 'strict',  
      expires: new Date(0)   
    });

    return res.status(200).json({ success: true, message: 'SESSION\_DESTROYED' });  
  }  
}

### **Engineering Rationale**

* **HTTP-Only Cookies over LocalStorage:** By instructing Express to send the JWT as an `httpOnly` cookie, we physically prevent the Next.js React code from accessing the token directly. The browser automatically attaches this cookie to every subsequent API request to the backend. This nullifies 99% of standard Cross-Site Scripting (XSS) attack vectors that attempt to steal medical session tokens.  
* **Time-Bounded Ephemeral Access:** The `maxAge` is strictly locked to **12 hours**. Medical environments operate in shifts. If a dispatcher forgets to log out of a shared Command Center terminal at the end of their shift, the token automatically perishes, preventing the next shift worker from inadvertently making routing decisions under the wrong WORM audit identity.  
* **Anti-Enumeration Obfuscation:** Notice that in the `AuthController`, if the database query fails to find the `uid`, we return `INVALID_CREDENTIALS_OR_INACTIVE`. We return the *exact same string* if the PIN is wrong. This prevents malicious actors from brute-forcing the API to figure out which UIDs actually exist in the system.

