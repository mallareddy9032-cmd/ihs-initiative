// ============================================================================
// FILE: android/app/src/main/java/com/ihs/DirectSmsModule.kt
// CONTEXT: Native Bridge for Zero-Friction SMS Fallback
// ============================================================================

package com.ihs

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DirectSmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DirectSmsModule"
    }

    @ReactMethod
    fun sendDirectSms(phoneNumber: String, message: String, promise: Promise) {
        try {
            if (phoneNumber.isBlank() || message.isBlank()) {
                promise.reject("SMS_DISPATCH_FAILED", "Phone number and message are required.")
                return
            }

            val hasPermission = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.SEND_SMS
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasPermission) {
                promise.reject("SMS_PERMISSION_DENIED", "SEND_SMS permission is not granted.")
                return
            }

            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                reactContext.getSystemService(SmsManager::class.java)
                    ?: SmsManager.getDefault()
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            // Split message if payload exceeds standard 160 GSM characters
            val parts = smsManager.divideMessage(message)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)

            promise.resolve("SMS_DISPATCH_SUCCESS")
        } catch (e: Exception) {
            promise.reject("SMS_DISPATCH_FAILED", e.message, e)
        }
    }
}
