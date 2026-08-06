// ============================================================================
// FILE: service/BleScannerDaemon.kt
// CONTEXT: Native Kotlin BLE Foreground Service
// ============================================================================

package com.ihs.fieldtablet.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.NotificationCompat
import com.ihs.fieldtablet.R
import com.ihs.fieldtablet.casestate.ActiveCaseManager
import com.ihs.fieldtablet.data.local.DatabaseProvider
import com.ihs.fieldtablet.data.local.LocalTelemetry
import com.ihs.fieldtablet.ui.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withTimeoutOrNull
import java.util.concurrent.ConcurrentHashMap

class BleScannerDaemon : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var scanner: BluetoothLeScanner? = null
    private val connectMutex = Mutex()
    private val inFlightDevices = ConcurrentHashMap.newKeySet<String>()

    // Target Hardware (ECG, Oximeter, BP) — PRD Section 3
    private val targetUuids = listOf(
        "0000180D-0000-1000-8000-00805f9b34fb", // 12-Lead ECG (0x180D)
        "00001822-0000-1000-8000-00805f9b34fb", // Pulse Oximeter (0x1822)
        "00001810-0000-1000-8000-00805f9b34fb"  // BP Monitor (0x1810)
    )

    override fun onCreate() {
        super.onCreate()
        DatabaseProvider.init(applicationContext)
        createNotificationChannel()
        Log.i(TAG, "BleScannerDaemon created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopScanner()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_INSERT_MANUAL_FALLBACK -> {
                val mac = intent.getStringExtra(EXTRA_DEVICE_MAC) ?: return START_STICKY
                val photoPath = intent.getStringExtra(EXTRA_PHOTO_PATH)
                val payloadJson = intent.getStringExtra(EXTRA_PAYLOAD_JSON) ?: "{}"
                val serviceUuid = intent.getStringExtra(EXTRA_SERVICE_UUID) ?: "MANUAL"
                scope.launch {
                    insertManualFallback(mac, serviceUuid, payloadJson, photoPath)
                }
                return START_STICKY
            }
        }

        val notification = buildPersistentNotification("IHS Medical Scanner Active")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        initializeScanner()
        // OS will recreate service if memory is critically low
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopScanner()
        scope.cancel()
        Log.i(TAG, "BleScannerDaemon destroyed")
        super.onDestroy()
    }

    @SuppressLint("MissingPermission")
    private fun initializeScanner() {
        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        val adapter: BluetoothAdapter = bluetoothManager.adapter
            ?: run {
                Log.e(TAG, "Bluetooth adapter unavailable")
                broadcastScannerError("BLUETOOTH_UNAVAILABLE")
                return
            }

        if (!adapter.isEnabled) {
            Log.e(TAG, "Bluetooth disabled")
            broadcastScannerError("BLUETOOTH_DISABLED")
            return
        }

        scanner = adapter.bluetoothLeScanner
        val bleScanner = scanner
        if (bleScanner == null) {
            broadcastScannerError("BLE_SCANNER_NULL")
            return
        }

        val filters = targetUuids.map { uuid ->
            ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(uuid)).build()
        }

        // PRD P4-1.1: Aggressive scanning loop (500ms delay)
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setReportDelay(500L)
            .build()

        try {
            bleScanner.startScan(filters, settings, scanCallback)
            Log.i(TAG, "LOW_LATENCY BLE scan started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing BLE permissions", e)
            broadcastScannerError("MISSING_BLE_PERMISSIONS")
        }
    }

    @SuppressLint("MissingPermission")
    private fun stopScanner() {
        try {
            scanner?.stopScan(scanCallback)
        } catch (e: Exception) {
            Log.w(TAG, "stopScan failed", e)
        }
        scanner = null
    }

    private val scanCallback = object : ScanCallback() {
        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            results.forEach { handleScanResult(it) }
        }

        override fun onScanResult(callbackType: Int, result: ScanResult) {
            handleScanResult(result)
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "BLE scan failed code=$errorCode")
            broadcastScannerError("SCAN_FAILED_$errorCode")
        }
    }

    @SuppressLint("MissingPermission")
    private fun handleScanResult(result: ScanResult) {
        val macAddress = result.device.address ?: return
        if (!inFlightDevices.add(macAddress)) {
            return // already connecting
        }

        scope.launch {
            try {
                connectMutex.withLock {
                    // 1. Enforce 60-Second Timeout Fallback (PRD P4-2.1)
                    val connectionResult = withTimeoutOrNull(60_000L) {
                        GattManager.connectAndExtract(applicationContext, result.device)
                    }

                    if (connectionResult == null) {
                        // Timeout triggers UI broadcast to unlock manual fields & camera
                        Log.w(TAG, "BLE_TIMEOUT_60S for $macAddress")
                        broadcastManualFallbackRequired(macAddress)
                    } else {
                        // 2. Write telemetry to local SQLite Room DB (never to network)
                        DatabaseProvider.db.telemetryDao().insert(
                            LocalTelemetry(
                                caseId = ActiveCaseManager.currentCaseId,
                                serviceUuid = connectionResult.uuid,
                                deviceMacAddress = macAddress,
                                payloadJson = connectionResult.payload
                            )
                        )
                        Log.i(TAG, "Telemetry buffered for $macAddress uuid=${connectionResult.uuid}")
                        broadcastTelemetryCaptured(macAddress, connectionResult.uuid)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "GATT extract failed for $macAddress", e)
                broadcastManualFallbackRequired(macAddress)
            } finally {
                inFlightDevices.remove(macAddress)
            }
        }
    }

    private suspend fun insertManualFallback(
        macAddress: String,
        serviceUuid: String,
        payloadJson: String,
        photoPath: String?
    ) {
        DatabaseProvider.db.telemetryDao().insertManualFallback(
            LocalTelemetry(
                caseId = ActiveCaseManager.currentCaseId,
                serviceUuid = serviceUuid,
                deviceMacAddress = macAddress,
                payloadJson = payloadJson,
                isManualFallback = true,
                photoVerificationPath = photoPath
            )
        )
        Log.i(TAG, "Manual fallback telemetry buffered for $macAddress")
    }

    private fun broadcastManualFallbackRequired(macAddress: String) {
        val intent = Intent(ACTION_MANUAL_FALLBACK_REQUIRED).apply {
            setPackage(packageName)
            putExtra(EXTRA_DEVICE_MAC, macAddress)
            putExtra(EXTRA_REASON, "BLE_TIMEOUT_60S")
            putExtra(EXTRA_REQUIRES_PHOTO, true)
        }
        sendBroadcast(intent)
    }

    private fun broadcastTelemetryCaptured(macAddress: String, serviceUuid: String) {
        val intent = Intent(ACTION_TELEMETRY_CAPTURED).apply {
            setPackage(packageName)
            putExtra(EXTRA_DEVICE_MAC, macAddress)
            putExtra(EXTRA_SERVICE_UUID, serviceUuid)
        }
        sendBroadcast(intent)
    }

    private fun broadcastScannerError(code: String) {
        val intent = Intent(ACTION_SCANNER_ERROR).apply {
            setPackage(packageName)
            putExtra(EXTRA_REASON, code)
        }
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "IHS Medical BLE Scanner",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Persistent medical device scan notification"
            setShowBadge(false)
        }
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun buildPersistentNotification(content: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("IHS Field Tablet")
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_ble_scanner)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    companion object {
        private const val TAG = "BleScannerDaemon"
        private const val CHANNEL_ID = "ihs_ble_scanner"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_STOP = "com.ihs.fieldtablet.action.STOP_BLE_SCANNER"
        const val ACTION_INSERT_MANUAL_FALLBACK = "com.ihs.fieldtablet.action.INSERT_MANUAL_FALLBACK"
        const val ACTION_MANUAL_FALLBACK_REQUIRED = "com.ihs.fieldtablet.action.MANUAL_FALLBACK_REQUIRED"
        const val ACTION_TELEMETRY_CAPTURED = "com.ihs.fieldtablet.action.TELEMETRY_CAPTURED"
        const val ACTION_SCANNER_ERROR = "com.ihs.fieldtablet.action.SCANNER_ERROR"

        const val EXTRA_DEVICE_MAC = "device_mac"
        const val EXTRA_PHOTO_PATH = "photo_path"
        const val EXTRA_PAYLOAD_JSON = "payload_json"
        const val EXTRA_SERVICE_UUID = "service_uuid"
        const val EXTRA_REASON = "reason"
        const val EXTRA_REQUIRES_PHOTO = "requires_photo"

        fun start(context: Context) {
            val intent = Intent(context, BleScannerDaemon::class.java)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, BleScannerDaemon::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }
}
