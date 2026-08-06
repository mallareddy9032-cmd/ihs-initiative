// ============================================================================
// FILE: data/local/LocalCaseEntity.kt
// CONTEXT: Offline-first local case cache (SQLite)
// ============================================================================

package com.ihs.fieldtablet.data.local

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query

@Entity(tableName = "local_cases")
data class LocalCase(
    @PrimaryKey(autoGenerate = true) val localId: Int = 0,
    val cloudCaseId: String? = null,
    val patientIhsUid: String,
    val currentStatus: String,
    val isMlcActive: Boolean = false,
    val syncStatus: Int = SYNC_PENDING,
    val lastModifiedLocal: Long = System.currentTimeMillis()
) {
    companion object {
        const val SYNC_PENDING = 0
        const val SYNCED = 1
        const val SYNC_CONFLICT = 2
    }
}

@Dao
interface LocalCaseDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(case: LocalCase): Long

    @Query("SELECT * FROM local_cases WHERE localId = :id LIMIT 1")
    suspend fun getById(id: Int): LocalCase?

    @Query("SELECT * FROM local_cases WHERE cloudCaseId = :cloudCaseId LIMIT 1")
    suspend fun getByCloudCaseId(cloudCaseId: String): LocalCase?

    @Query("UPDATE local_cases SET isMlcActive = 1, lastModifiedLocal = :now WHERE localId = :id")
    suspend fun activateSafeHarbor(id: Int, now: Long = System.currentTimeMillis())
}
