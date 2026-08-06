// ============================================================================
// FILE: service/GattManager.kt
// CONTEXT: BLE GATT connect + characteristic extraction
// ============================================================================

package com.ihs.fieldtablet.service

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class GattExtractionResult(
    val uuid: String,
    val payload: String
)

object GattManager {
    private const val TAG = "GattManager"

    /**
     * Connects to [device] and extracts the first readable characteristic payload.
     * Suspends until GATT succeeds or throws; callers wrap with withTimeoutOrNull(60_000).
     */
    @SuppressLint("MissingPermission")
    suspend fun connectAndExtract(context: Context, device: BluetoothDevice): GattExtractionResult {
        return suspendCancellableCoroutine { continuation ->
            var gatt: BluetoothGatt? = null
            var settled = false

            fun settleSuccess(result: GattExtractionResult) {
                if (settled) return
                settled = true
                closeQuietly(gatt)
                if (continuation.isActive) {
                    continuation.resume(result)
                }
            }

            fun settleFailure(error: Throwable) {
                if (settled) return
                settled = true
                closeQuietly(gatt)
                if (continuation.isActive) {
                    continuation.resumeWithException(error)
                }
            }

            val callback = object : BluetoothGattCallback() {
                override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        settleFailure(IllegalStateException("GATT connect status=$status"))
                        return
                    }
                    when (newState) {
                        BluetoothProfile.STATE_CONNECTED -> g.discoverServices()
                        BluetoothProfile.STATE_DISCONNECTED ->
                            settleFailure(IllegalStateException("GATT disconnected before extract"))
                    }
                }

                override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        settleFailure(IllegalStateException("Service discovery failed status=$status"))
                        return
                    }

                    val characteristic = g.services
                        .asSequence()
                        .flatMap { service -> service.characteristics.asSequence() }
                        .firstOrNull { characteristic ->
                            (characteristic.properties and BluetoothGattCharacteristic.PROPERTY_READ) != 0 ||
                                (characteristic.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0
                        }

                    if (characteristic == null) {
                        settleFailure(IllegalStateException("No readable/notify characteristic"))
                        return
                    }

                    val readOk = g.readCharacteristic(characteristic)
                    if (!readOk) {
                        settleSuccess(
                            GattExtractionResult(
                                uuid = shortUuid(
                                    characteristic.service?.uuid?.toString()
                                        ?: characteristic.uuid.toString()
                                ),
                                payload = "{\"service\":\"${characteristic.uuid}\",\"bytes\":\"\"}"
                            )
                        )
                    }
                }

                override fun onCharacteristicRead(
                    g: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic,
                    status: Int
                ) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        settleFailure(IllegalStateException("Characteristic read failed status=$status"))
                        return
                    }
                    val bytes = characteristic.value ?: ByteArray(0)
                    val encoded = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    settleSuccess(
                        GattExtractionResult(
                            uuid = shortUuid(
                                characteristic.service?.uuid?.toString()
                                    ?: characteristic.uuid.toString()
                            ),
                            payload = "{\"service\":\"${characteristic.uuid}\",\"reading_value\":\"$encoded\"}"
                        )
                    )
                }
            }

            gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)

            continuation.invokeOnCancellation {
                closeQuietly(gatt)
            }
        }
    }

    private fun closeQuietly(gatt: BluetoothGatt?) {
        try {
            gatt?.disconnect()
            gatt?.close()
        } catch (e: Exception) {
            Log.w(TAG, "GATT cleanup failed", e)
        }
    }

    private fun shortUuid(full: String): String {
        return when {
            full.contains("180d", ignoreCase = true) -> "0x180D"
            full.contains("1822", ignoreCase = true) -> "0x1822"
            full.contains("1810", ignoreCase = true) -> "0x1810"
            full.contains("1809", ignoreCase = true) -> "0x1809"
            else -> full.take(10)
        }
    }
}
