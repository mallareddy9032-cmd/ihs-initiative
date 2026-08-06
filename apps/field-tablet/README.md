# IHS Field Staff Tablet (Native Android Kotlin)
# Offline-first BLE ingestion + WorkManager sync

## Open in Android Studio
1. File → Open → `apps/field-tablet`
2. Sync Gradle
3. Run on API 28+ device/emulator with BLE

## Core modules
- `data/local/TelemetryEntity.kt` — Room entity + DAO
- `service/BleScannerDaemon.kt` — START_STICKY foreground BLE scanner
- `worker/TelemetrySyncWorker.kt` — batch REST sync with Base64 photo fallback

## API target
`BuildConfig.API_BASE_URL` defaults to `http://10.0.2.2:8080` (emulator → host Cloud Engine).
