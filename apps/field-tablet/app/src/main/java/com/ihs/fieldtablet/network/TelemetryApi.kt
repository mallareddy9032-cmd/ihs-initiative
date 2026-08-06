// ============================================================================
// FILE: network/TelemetryApi.kt
// CONTEXT: Retrofit contract for /v1/telemetry/sync
// ============================================================================

package com.ihs.fieldtablet.network

import com.google.gson.annotations.SerializedName
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

data class TelemetryRecordDto(
    @SerializedName("device_mac_address") val deviceMacAddress: String,
    @SerializedName("service_uuid") val serviceUuid: String,
    @SerializedName("reading_payload") val readingPayload: Any,
    @SerializedName("is_manual_fallback") val isManualFallback: Boolean,
    @SerializedName("photo_verification_b64") val photoVerificationB64: String?,
    @SerializedName("recorded_at") val recordedAt: String
)

data class TelemetrySyncRequest(
    @SerializedName("case_id") val caseId: String,
    @SerializedName("telemetry_records") val telemetryRecords: List<TelemetryRecordDto>
)

data class TelemetrySyncResponse(
    @SerializedName("success") val success: Boolean? = null,
    @SerializedName("records_ingested") val recordsIngested: Int? = null,
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: String? = null
)

interface TelemetryApi {
    @POST("/v1/telemetry/sync")
    suspend fun syncBatch(@Body body: TelemetrySyncRequest): Response<TelemetrySyncResponse>
}
