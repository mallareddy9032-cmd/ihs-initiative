### **Field Staff Tablet**

### **SPRINT 4: Field Staff Tablet (Native Kotlin)**

The **Field Staff Tablet** operates in the most hostile technical environments of the IHS deployment zone. In the corridors of Dharmavaram and Gooty, 4G LTE is intermittent, and corrugated metal roofs create severe Bluetooth interference.

This application must be strictly **Offline-First**. It cannot rely on the cloud to function. We will build this using **Android Room (SQLite)** for the local database, **Android WorkManager** for the sync engine, and a **Foreground Service** for the BLE daemon to prevent the Android OS from terminating our medical scans to save battery.

### **STEP 1: Offline-First SQLite Schema (Android Room)**

All data generated in the field is written to this local SQLite database first. The sync status flag (`SYNC_PENDING`, `SYNCED`) dictates what gets pushed to the cloud when connectivity is restored.

Kotlin  
// \============================================================================  
// FILE: data/local/TelemetryEntity.kt  
// CONTEXT: Android Room SQLite Entity & DAO  
// \============================================================================  
import androidx.room.\*

@Entity(tableName \= "local\_telemetry\_buffer")  
data class LocalTelemetry(  
    @PrimaryKey(autoGenerate \= true) val bufferId: Int \= 0,  
    val caseId: String,  
      
    val serviceUuid: String,  
    val deviceMacAddress: String,  
    val payloadJson: String,   
      
    // PRD P4-2.2: Photo-Verified Fallback  
    val isManualFallback: Boolean \= false,  
    val photoVerificationPath: String? \= null, // Local URI to compressed image  
      
    val recordedAt: Long \= System.currentTimeMillis(),  
    val syncStatus: Int \= SYNC\_PENDING // 0 \= PENDING, 1 \= SYNCED  
) {  
    companion object {  
        const val SYNC\_PENDING \= 0  
        const val SYNCED \= 1  
    }  
}

@Dao  
interface TelemetryDao {  
    @Insert(onConflict \= OnConflictStrategy.REPLACE)  
    suspend fun insert(telemetry: LocalTelemetry): Long

    @Query("SELECT \* FROM local\_telemetry\_buffer WHERE syncStatus \= ${LocalTelemetry.SYNC\_PENDING}")  
    suspend fun getUnsyncedRecords(): List\<LocalTelemetry\>

    @Query("UPDATE local\_telemetry\_buffer SET syncStatus \= ${LocalTelemetry.SYNCED} WHERE bufferId IN (:ids)")  
    suspend fun markAsSynced(ids: List\<Int\>)  
}

### **STEP 2: The Unkillable BLE GATT Daemon**

Medical scanning cannot pause if the nurse switches to another app. We deploy this as an Android `ForegroundService`, which requires a persistent notification alerting the user that the scanner is actively pulling telemetry.

Kotlin  
// \============================================================================  
// FILE: service/BleScannerDaemon.kt  
// CONTEXT: Native Kotlin BLE Foreground Service  
// \============================================================================  
import android.app.Service  
import android.bluetooth.le.\*  
import android.os.ParcelUuid  
import kotlinx.coroutines.\*

class BleScannerDaemon : Service() {  
    private val scope \= CoroutineScope(Dispatchers.IO \+ SupervisorJob())  
    private lateinit var scanner: BluetoothLeScanner

    // Target Hardware (ECG, Oximeter, BP, Temp)  
    private val targetUuids \= listOf(  
        "0000180D-0000-1000-8000-00805f9b34fb",   
        "00001822-0000-1000-8000-00805f9b34fb"  
    )

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {  
        startForeground(1, buildPersistentNotification("IHS Medical Scanner Active"))  
        initializeScanner()  
        return START\_STICKY // OS will recreate service if memory is critically low  
    }

    private fun initializeScanner() {  
        scanner \= bluetoothAdapter.bluetoothLeScanner  
        val filters \= targetUuids.map { ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(it)).build() }  
          
        // PRD P4-1.1: Aggressive scanning loop (500ms delay)  
        val settings \= ScanSettings.Builder()  
            .setScanMode(ScanSettings.SCAN\_MODE\_LOW\_LATENCY)  
            .setReportDelay(500L)   
            .build()

        scanner.startScan(filters, settings, scanCallback)  
    }

    private val scanCallback \= object : ScanCallback() {  
        override fun onScanResult(callbackType: Int, result: ScanResult) {  
            scope.launch {  
                val macAddress \= result.device.address  
                  
                // 1\. Enforce 60-Second Timeout Fallback (PRD P4-2.1)  
                val connectionResult \= withTimeoutOrNull(60\_000L) {  
                    GattManager.connectAndExtract(result.device)  
                }

                if (connectionResult \== null) {  
                    // Timeout triggers UI broadcast to unlock manual fields & camera  
                    broadcastManualFallbackRequired(macAddress)  
                } else {  
                    // 2\. Write telemetry to local SQLite Room DB  
                    DatabaseProvider.db.telemetryDao().insert(  
                        LocalTelemetry(  
                            caseId \= ActiveCaseManager.currentCaseId,  
                            serviceUuid \= connectionResult.uuid,  
                            deviceMacAddress \= macAddress,  
                            payloadJson \= connectionResult.payload  
                        )  
                    )  
                }  
            }  
        }  
    }  
}

### **STEP 3: The Background Sync Engine (WorkManager)**

The tablet does not wait for a perfect connection. It continuously queues background tasks using Android's `WorkManager`. When the OS detects a valid `NETWORK_TYPE_UNMETERED` or strong cellular connection, it executes the batch sync to the Phase 2 REST API.

Kotlin  
// \============================================================================  
// FILE: worker/TelemetrySyncWorker.kt  
// CONTEXT: Offline-to-Cloud Batch Sync  
// \============================================================================  
import android.content.Context  
import androidx.work.CoroutineWorker  
import androidx.work.WorkerParameters  
import android.util.Base64  
import java.io.File

class TelemetrySyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {  
        val dao \= DatabaseProvider.db.telemetryDao()  
        val unsyncedRecords \= dao.getUnsyncedRecords()

        if (unsyncedRecords.isEmpty()) return Result.success()

        // 1\. Process local records and encode images for API compliance  
        val payloadArray \= unsyncedRecords.map { record \-\>  
            val photoB64 \= if (record.isManualFallback && record.photoVerificationPath \!= null) {  
                // Read local compressed JPEG and convert to Base64 for the REST API  
                val fileBytes \= File(record.photoVerificationPath).readBytes()  
                Base64.encodeToString(fileBytes, Base64.NO\_WRAP)  
            } else null

            mapOf(  
                "device\_mac\_address" to record.deviceMacAddress,  
                "service\_uuid" to record.serviceUuid,  
                "reading\_payload" to record.payloadJson,  
                "is\_manual\_fallback" to record.isManualFallback,  
                "photo\_verification\_b64" to photoB64,  
                "recorded\_at" to record.recordedAt  
            )  
        }

        // 2\. Transmit to Cloud REST API  
        val requestBody \= mapOf(  
            "case\_id" to unsyncedRecords.first().caseId,  
            "telemetry\_records" to payloadArray  
        )

        return try {  
            val response \= ApiClient.post("/v1/telemetry/sync", requestBody)  
              
            if (response.isSuccessful) {  
                // 3\. Mark locally as synced to prevent duplicate transmissions  
                dao.markAsSynced(unsyncedRecords.map { it.bufferId })  
                Result.success()  
            } else {  
                Result.retry() // Will automatically backoff and retry later  
            }  
        } catch (e: Exception) {  
            Result.retry() // Network failure, hold in SQLite  
        }  
    }  
}

### **Engineering Rationale**

* **Battery Management (`START_STICKY`)**: The BLE daemon uses `START_STICKY`. If the tablet's RAM fills up and the OS kills the service, Android will automatically restart it as soon as memory frees up, ensuring the physician does not lose their telemetry feed during an active consult.  
* **Decoupled Architecture**: Notice that the `BleScannerDaemon` **never** attempts to send data to the network. It only talks to the SQLite database. The `TelemetrySyncWorker` **never** talks to the Bluetooth hardware. It only reads from SQLite. This separation of concerns ensures that a network failure cannot crash the hardware scanner, and a Bluetooth crash cannot stop offline records from syncing.  
* **Base64 Translation**: The `TelemetrySyncWorker` fulfills the strict contract we wrote in the Phase 2 REST API. If `isManualFallback` is true, the worker reads the local physical file path, converts the JPEG to a Base64 string in memory, and appends it to the payload to satisfy the WORM compliance auditor.

