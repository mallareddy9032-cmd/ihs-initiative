// ============================================================================
// FILE: data/local/AppDatabase.kt
// CONTEXT: Room database definition
// ============================================================================

package com.ihs.fieldtablet.data.local

import androidx.room.Database
import androidx.room.RoomDatabase

@Database(
    entities = [LocalTelemetry::class, LocalCase::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun telemetryDao(): TelemetryDao
    abstract fun localCaseDao(): LocalCaseDao
}
