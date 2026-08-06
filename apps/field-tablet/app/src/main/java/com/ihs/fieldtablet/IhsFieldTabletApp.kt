// ============================================================================
// FILE: IhsFieldTabletApp.kt
// CONTEXT: Application entry — DB + WorkManager bootstrap
// ============================================================================

package com.ihs.fieldtablet

import android.app.Application
import android.util.Log
import androidx.work.Configuration
import com.ihs.fieldtablet.data.local.DatabaseProvider
import com.ihs.fieldtablet.worker.SyncScheduler

class IhsFieldTabletApp : Application(), Configuration.Provider {

    override fun onCreate() {
        super.onCreate()
        DatabaseProvider.init(this)
        SyncScheduler.enqueuePeriodicSync(this)
        Log.i(TAG, "IHS Field Tablet application initialized")
    }

    override fun getWorkManagerConfiguration(): Configuration {
        return Configuration.Builder()
            .setMinimumLoggingLevel(Log.INFO)
            .build()
    }

    companion object {
        private const val TAG = "IhsFieldTabletApp"
    }
}
