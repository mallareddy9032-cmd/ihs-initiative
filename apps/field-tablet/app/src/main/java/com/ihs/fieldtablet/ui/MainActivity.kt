// ============================================================================
// FILE: ui/MainActivity.kt
// CONTEXT: Lifecycle host — permissions, BLE service, sync triggers
// ============================================================================

package com.ihs.fieldtablet.ui

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.ihs.fieldtablet.R
import com.ihs.fieldtablet.casestate.ActiveCaseManager
import com.ihs.fieldtablet.data.local.DatabaseProvider
import com.ihs.fieldtablet.service.BleScannerDaemon
import com.ihs.fieldtablet.worker.SyncScheduler
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var statusText: TextView
    private lateinit var pendingCountText: TextView
    private var scannerRunning = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        val denied = grants.filterValues { !it }.keys
        if (denied.isEmpty()) {
            startBleScanner()
        } else {
            statusText.text = "Permissions denied: ${denied.joinToString()}"
            Toast.makeText(this, "BLE/Location permissions required for medical scan", Toast.LENGTH_LONG).show()
        }
    }

    private val fallbackReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                BleScannerDaemon.ACTION_MANUAL_FALLBACK_REQUIRED -> {
                    val mac = intent.getStringExtra(BleScannerDaemon.EXTRA_DEVICE_MAC)
                    statusText.text = "BLE_TIMEOUT_60S — Manual fallback + photo required ($mac)"
                    Toast.makeText(
                        this@MainActivity,
                        "Hardware timeout. Capture device photo for WORM compliance.",
                        Toast.LENGTH_LONG
                    ).show()
                }
                BleScannerDaemon.ACTION_TELEMETRY_CAPTURED -> {
                    refreshPendingCount()
                    val uuid = intent.getStringExtra(BleScannerDaemon.EXTRA_SERVICE_UUID)
                    statusText.text = "Telemetry buffered ($uuid)"
                }
                BleScannerDaemon.ACTION_SCANNER_ERROR -> {
                    val reason = intent.getStringExtra(BleScannerDaemon.EXTRA_REASON)
                    statusText.text = "Scanner error: $reason"
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        DatabaseProvider.init(applicationContext)

        // Demo bind — replace with Command Center case push in later sprint
        if (ActiveCaseManager.currentCaseId == "UNASSIGNED") {
            ActiveCaseManager.bindCase("CASE-OFFLINE-LOCAL", "IHS-ANTP-00000")
        }

        statusText = findViewById(R.id.statusText)
        pendingCountText = findViewById(R.id.pendingCountText)

        findViewById<Button>(R.id.btnStartScanner).setOnClickListener {
            ensurePermissionsAndStart()
        }
        findViewById<Button>(R.id.btnStopScanner).setOnClickListener {
            BleScannerDaemon.stop(this)
            scannerRunning = false
            statusText.text = "Scanner stopped"
        }
        findViewById<Button>(R.id.btnSyncNow).setOnClickListener {
            SyncScheduler.enqueueImmediateSync(this)
            statusText.text = "Sync enqueued (WorkManager backoff enabled)"
            Toast.makeText(this, "Background sync requested", Toast.LENGTH_SHORT).show()
        }

        refreshPendingCount()
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter().apply {
            addAction(BleScannerDaemon.ACTION_MANUAL_FALLBACK_REQUIRED)
            addAction(BleScannerDaemon.ACTION_TELEMETRY_CAPTURED)
            addAction(BleScannerDaemon.ACTION_SCANNER_ERROR)
        }
        ContextCompat.registerReceiver(
            this,
            fallbackReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    override fun onStop() {
        try {
            unregisterReceiver(fallbackReceiver)
        } catch (e: Exception) {
            Log.w(TAG, "Receiver already unregistered", e)
        }
        super.onStop()
    }

    override fun onDestroy() {
        // Do NOT stop the foreground BLE service on activity destroy —
        // medical scanning must survive UI backgrounding (START_STICKY daemon).
        super.onDestroy()
    }

    private fun ensurePermissionsAndStart() {
        val missing = requiredPermissions().filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            startBleScanner()
        } else {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun startBleScanner() {
        BleScannerDaemon.start(this)
        scannerRunning = true
        statusText.text = "BLE LOW_LATENCY scanner running (START_STICKY)"
        SyncScheduler.enqueuePeriodicSync(this)
    }

    private fun refreshPendingCount() {
        lifecycleScope.launch {
            val count = DatabaseProvider.db.telemetryDao().countUnsynced()
            pendingCountText.text = "Pending sync: $count"
        }
    }

    private fun requiredPermissions(): List<String> {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            perms += Manifest.permission.BLUETOOTH_SCAN
            perms += Manifest.permission.BLUETOOTH_CONNECT
        } else {
            perms += Manifest.permission.BLUETOOTH
            perms += Manifest.permission.BLUETOOTH_ADMIN
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms += Manifest.permission.POST_NOTIFICATIONS
        }

        return perms
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}
