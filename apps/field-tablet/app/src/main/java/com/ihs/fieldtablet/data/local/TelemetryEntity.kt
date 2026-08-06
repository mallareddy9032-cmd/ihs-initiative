// ============================================================================
// FILE: data/local/TelemetryEntity.kt
// CONTEXT: Android Room SQLite Entity & DAO
// ============================================================================

package com.ihs.fieldtablet.data.local

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(tableName = "local_telemetry_buffer")
data class LocalTelemetry(
    @PrimaryKey(autoGenerate = true) val bufferId: Int = 0,
    val caseId: String,

    val serviceUuid: String,
    val deviceMacAddress: String,
    val payloadJson: String,

    // PRD P4-2.2: Photo-Verified Fallback
    val isManualFallback: Boolean = false,
    val photoVerificationPath: String? = null, // Local URI/path to compressed image

    val recordedAt: Long = System.currentTimeMillis(),
    val syncStatus: Int = SYNC_PENDING // 0 = PENDING, 1 = SYNCED
) {
    companion object {
        const val SYNC_PENDING = 0
        const val SYNCED = 1
        const val SYNC_CONFLICT = 2
    }
}

@Dao
interface TelemetryDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(telemetry: LocalTelemetry): Long

    @Query("SELECT * FROM local_telemetry_buffer WHERE syncStatus = ${LocalTelemetry.SYNC_PENDING}")
    suspend fun getUnsyncedRecords(): List<LocalTelemetry>

    @Query(
        "SELECT * FROM local_telemetry_buffer WHERE syncStatus = ${LocalTelemetry.SYNC_PENDING} " +
            "AND caseId = :caseId ORDER BY recordedAt ASC"
    )
    suspend fun getUnsyncedRecordsForCase(caseId: String): List<LocalTelemetry>

    @Query(
        "UPDATE local_telemetry_buffer SET syncStatus = ${LocalTelemetry.SYNCED} " +
            "WHERE bufferId IN (:ids)"
    )
    suspend fun markAsSynced(ids: List<Int>)

    @Query(
        "UPDATE local_telemetry_buffer SET syncStatus = ${LocalTelemetry.SYNC_CONFLICT} " +
            "WHERE bufferId IN (:ids)"
    )
    suspend fun markAsConflict(ids: List<Int>)

    @Query("SELECT COUNT(*) FROM local_telemetry_buffer WHERE syncStatus = ${LocalTelemetry.SYNC_PENDING}")
    suspend fun countUnsynced(): Int

    @Query("SELECT * FROM local_telemetry_buffer WHERE bufferId = :id LIMIT 1")
    suspend fun getById(id: Int): LocalTelemetry?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertManualFallback(telemetry: LocalTelemetry): Long
}
