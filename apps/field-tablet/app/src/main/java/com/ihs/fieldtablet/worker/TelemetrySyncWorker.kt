// ============================================================================
// FILE: worker/TelemetrySyncWorker.kt
// CONTEXT: Offline-to-Cloud Batch Sync
// ============================================================================

package com.ihs.fieldtablet.worker

import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.gson.JsonParser
import com.ihs.fieldtablet.data.local.DatabaseProvider
import com.ihs.fieldtablet.network.ApiClient
import com.ihs.fieldtablet.network.TelemetryRecordDto
import com.ihs.fieldtablet.network.TelemetrySyncRequest
import java.io.File
import java.time.Instant

class TelemetrySyncWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        DatabaseProvider.init(applicationContext)
        val dao = DatabaseProvider.db.telemetryDao()
        val unsyncedRecords = dao.getUnsyncedRecords()

        if (unsyncedRecords.isEmpty()) {
            Log.i(TAG, "No pending telemetry to sync")
            return Result.success()
        }

        // Group by case so each REST batch satisfies the OpenAPI case_id contract
        val byCase = unsyncedRecords.groupBy { it.caseId }

        var anyFailure = false
        var anyHardFailure = false

        for ((caseId, records) in byCase) {
            if (caseId == "UNASSIGNED") {
                Log.w(TAG, "Skipping ${records.size} records with UNASSIGNED caseId")
                continue
            }

            val payloadArray = records.map { record ->
                val photoB64 = if (record.isManualFallback && record.photoVerificationPath != null) {
                    // Read local compressed JPEG and convert to Base64 for the REST API
                    val path = record.photoVerificationPath
                    val file = resolvePhotoFile(path)
                    if (file == null || !file.exists()) {
                        Log.e(TAG, "Missing photo for manual fallback bufferId=${record.bufferId}")
                        anyHardFailure = true
                        return@map null
                    }
                    Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
                } else {
                    null
                }

                if (record.isManualFallback && photoB64.isNullOrBlank()) {
                    // PRD P4-2.2 — never transmit non-compliant manual entries
                    anyHardFailure = true
                    return@map null
                }

                val readingPayload = parsePayload(record.payloadJson)

                TelemetryRecordDto(
                    deviceMacAddress = record.deviceMacAddress,
                    serviceUuid = record.serviceUuid,
                    readingPayload = readingPayload,
                    isManualFallback = record.isManualFallback,
                    photoVerificationB64 = photoB64,
                    recordedAt = Instant.ofEpochMilli(record.recordedAt).toString()
                )
            }

            if (payloadArray.any { it == null }) {
                Log.e(TAG, "Hard validation failure for case=$caseId — will retry after photo repair")
                anyFailure = true
                continue
            }

            val requestBody = TelemetrySyncRequest(
                caseId = caseId,
                telemetryRecords = payloadArray.filterNotNull()
            )

            try {
                // Transmit to Cloud REST API
                val response = ApiClient.telemetryApi.syncBatch(requestBody)

                if (response.isSuccessful) {
                    // Mark locally as synced to prevent duplicate transmissions
                    dao.markAsSynced(records.map { it.bufferId })
                    Log.i(
                        TAG,
                        "Synced ${records.size} records for case=$caseId " +
                            "(ingested=${response.body()?.recordsIngested})"
                    )
                } else {
                    Log.w(TAG, "Sync HTTP ${response.code()} for case=$caseId — scheduling retry")
                    anyFailure = true
                }
            } catch (e: Exception) {
                Log.w(TAG, "Network failure syncing case=$caseId — hold in SQLite", e)
                anyFailure = true
            }
        }

        return when {
            anyHardFailure || anyFailure -> Result.retry() // WorkManager exponential backoff
            else -> Result.success()
        }
    }

    private fun resolvePhotoFile(path: String): File? {
        return try {
            when {
                path.startsWith("file://") -> File(path.removePrefix("file://"))
                path.startsWith("content://") -> {
                    // Copy content URI stream to cache for Base64 encoding
                    val uri = android.net.Uri.parse(path)
                    val temp = File(applicationContext.cacheDir, "sync_photo_${System.currentTimeMillis()}.jpg")
                    applicationContext.contentResolver.openInputStream(uri)?.use { input ->
                        temp.outputStream().use { output -> input.copyTo(output) }
                    } ?: return null
                    temp
                }
                else -> File(path)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to resolve photo path=$path", e)
            null
        }
    }

    private fun parsePayload(payloadJson: String): Any {
        return try {
            JsonParser.parseString(payloadJson)
        } catch (_: Exception) {
            payloadJson
        }
    }

    companion object {
        private const val TAG = "TelemetrySyncWorker"
        const val UNIQUE_WORK_NAME = "ihs_telemetry_batch_sync"
    }
}
