# IHS Client Mobile App (React Native)

Phase 4 edge client implementing PRD P1-1.3 panic resiliency.

## Core modules
- `android/.../com/ihs/DirectSmsModule.kt` — background `SmsManager` multipart SMS
- `src/services/EmergencyTriggerEngine.ts` — WSS vs 1,500ms race + AES-256 SMS fallback
- `src/screens/HomeScreen.tsx` — high-accuracy GPS + 1.5s long-press SOS
- `src/App.tsx` — auth-gated stack (Login physically removed when authenticated)
- `src/components/ActionOverlay.tsx` — un-dismissible overlay / hardware back intercept

## Run

```bash
cd apps/client-app
npm install
```

### Android
```bash
npm start
npm run android
```

### iOS (Simulator)
Requires Xcode + CocoaPods on the host machine.

```bash
# one-time native deps
cd ios && pod install && cd ..

npm start
npx react-native run-ios
# or: npm run ios
```

Open `ios/IHSClientApp.xcworkspace` in Xcode after `pod install` (not the `.xcodeproj`).

Grant **Location** (and on Android, **SMS**) permissions on first SOS hold.
