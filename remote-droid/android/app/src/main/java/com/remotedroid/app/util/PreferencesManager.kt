package com.remotedroid.app.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.remotedroid.app.BuildConfig
import java.security.SecureRandom
import java.util.UUID

/**
 * Persists device identity, the current pairing code/token and the
 * signaling server URL. Backed by EncryptedSharedPreferences so pairing
 * secrets are not stored in plaintext on disk.
 */
class PreferencesManager(context: Context) {

    private val prefs: SharedPreferences = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "remote_droid_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    } catch (e: Exception) {
        // Fallback: still functional, just unencrypted (e.g. on broken keystore devices)
        context.getSharedPreferences("remote_droid_prefs_fallback", Context.MODE_PRIVATE)
    }

    val deviceId: String
        get() {
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                id = UUID.randomUUID().toString().substring(0, 8)
                prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            return id
        }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, BuildConfig.DEFAULT_SIGNALING_URL)
            ?: BuildConfig.DEFAULT_SIGNALING_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value).apply()

    var pairingCode: String
        get() {
            var code = prefs.getString(KEY_PAIRING_CODE, null)
            if (code == null) {
                code = generatePairingCode()
                prefs.edit().putString(KEY_PAIRING_CODE, code).apply()
            }
            return code
        }
        set(value) = prefs.edit().putString(KEY_PAIRING_CODE, value).apply()

    /** Long-lived per-device secret shared only with the signaling server via the pairing code exchange. */
    val deviceSecret: String
        get() {
            var secret = prefs.getString(KEY_DEVICE_SECRET, null)
            if (secret == null) {
                secret = generateSecret(32)
                prefs.edit().putString(KEY_DEVICE_SECRET, secret).apply()
            }
            return secret
        }

    fun regeneratePairingCode(): String {
        val code = generatePairingCode()
        pairingCode = code
        return code
    }

    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_PAIRING_CODE = "pairing_code"
        private const val KEY_DEVICE_SECRET = "device_secret"

        private val secureRandom = SecureRandom()

        /** Human-friendly 6-digit numeric pairing code (e.g. "482913"). */
        fun generatePairingCode(): String {
            val n = secureRandom.nextInt(1_000_000)
            return n.toString().padStart(6, '0')
        }

        fun generateSecret(bytes: Int): String {
            val b = ByteArray(bytes)
            secureRandom.nextBytes(b)
            return b.joinToString("") { "%02x".format(it) }
        }
    }
}
