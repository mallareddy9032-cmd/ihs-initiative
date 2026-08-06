// ============================================================================
// FILE: data/local/DatabaseProvider.kt
// CONTEXT: Singleton Room database accessor
// ============================================================================

package com.ihs.fieldtablet.data.local

import android.content.Context
import androidx.room.Room

object DatabaseProvider {
    @Volatile
    private var instance: AppDatabase? = null

    val db: AppDatabase
        get() = instance
            ?: error("DatabaseProvider not initialized. Call DatabaseProvider.init(context) first.")

    fun init(context: Context) {
        if (instance == null) {
            synchronized(this) {
                if (instance == null) {
                    instance = Room.databaseBuilder(
                        context.applicationContext,
                        AppDatabase::class.java,
                        "ihs_field_tablet.db"
                    )
                        .fallbackToDestructiveMigration()
                        .build()
                }
            }
        }
    }
}
