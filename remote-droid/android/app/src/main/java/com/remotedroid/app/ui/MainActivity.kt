package com.remotedroid.app.ui

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.LayoutInflater
import android.view.accessibility.AccessibilityManager
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.remotedroid.app.R
import com.remotedroid.app.databinding.ActivityMainBinding
import com.remotedroid.app.databinding.DialogSettingsBinding
import com.remotedroid.app.service.RemoteAccessibilityService
import com.remotedroid.app.service.ScreenCaptureService
import com.remotedroid.app.util.PreferencesManager

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: PreferencesManager
    private lateinit var mediaProjectionManager: MediaProjectionManager

    private val statusReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val status = intent?.getStringExtra(ScreenCaptureService.EXTRA_STATUS) ?: return
            renderStatus(status)
        }
    }

    private val projectionPermissionLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startCaptureService(result.resultCode, result.data!!)
        } else {
            renderStatus(ScreenCaptureService.STATUS_ERROR)
        }
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { /* proceed regardless; foreground service still works, just without a visible badge on some OEMs */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = PreferencesManager(this)
        mediaProjectionManager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager

        refreshPairingUi()
        renderStatus(if (ScreenCaptureService.isRunning) ScreenCaptureService.STATUS_STREAMING else ScreenCaptureService.STATUS_STOPPED)

        binding.startStopButton.setOnClickListener {
            if (ScreenCaptureService.isRunning) {
                stopSession()
            } else {
                requestNotificationPermissionIfNeeded()
                requestProjectionPermission()
            }
        }

        binding.regenerateCodeButton.setOnClickListener {
            prefs.regeneratePairingCode()
            refreshPairingUi()
        }

        binding.enableAccessibilityButton.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        binding.settingsButton.setOnClickListener { showSettingsDialog() }

        binding.serverUrlText.text = prefs.serverUrl
    }

    override fun onResume() {
        super.onResume()
        LocalBroadcastManager.getInstance(this).registerReceiver(
            statusReceiver, IntentFilter(ScreenCaptureService.BROADCAST_STATUS)
        )
        updateAccessibilityWarning()
    }

    override fun onPause() {
        super.onPause()
        LocalBroadcastManager.getInstance(this).unregisterReceiver(statusReceiver)
    }

    private fun refreshPairingUi() {
        val code = prefs.pairingCode
        val formatted = "${code.substring(0, 3)} ${code.substring(3)}"
        binding.pairingCodeText.text = formatted
        binding.deviceIdText.text = getString(R.string.label_device_id) + ": " + prefs.deviceId
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    private fun requestProjectionPermission() {
        projectionPermissionLauncher.launch(mediaProjectionManager.createScreenCaptureIntent())
    }

    private fun startCaptureService(resultCode: Int, data: Intent) {
        val intent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_START
            putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
            putExtra(ScreenCaptureService.EXTRA_RESULT_DATA, data)
        }
        ContextCompat.startForegroundService(this, intent)
        binding.startStopButton.text = getString(R.string.btn_stop_session)
    }

    private fun stopSession() {
        val intent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ScreenCaptureService.ACTION_STOP
        }
        startService(intent)
        binding.startStopButton.text = getString(R.string.btn_start_session)
        renderStatus(ScreenCaptureService.STATUS_STOPPED)
    }

    private fun renderStatus(status: String) {
        val (textRes, colorRes) = when (status) {
            ScreenCaptureService.STATUS_CONNECTING_SERVER -> R.string.status_connected_server to R.color.status_amber
            ScreenCaptureService.STATUS_WAITING_PAIR -> R.string.status_waiting_pair to R.color.status_amber
            ScreenCaptureService.STATUS_STREAMING -> R.string.status_streaming to R.color.status_green
            ScreenCaptureService.STATUS_RECONNECTING -> R.string.status_reconnecting to R.color.status_amber
            ScreenCaptureService.STATUS_ERROR -> R.string.status_error to R.color.status_red
            else -> R.string.status_disconnected to R.color.status_red
        }
        binding.statusText.text = getString(textRes)
        binding.statusDot.background.setTint(ContextCompat.getColor(this, colorRes))

        binding.startStopButton.text = if (status == ScreenCaptureService.STATUS_STREAMING ||
            status == ScreenCaptureService.STATUS_WAITING_PAIR ||
            status == ScreenCaptureService.STATUS_CONNECTING_SERVER ||
            status == ScreenCaptureService.STATUS_RECONNECTING
        ) getString(R.string.btn_stop_session) else getString(R.string.btn_start_session)
    }

    private fun updateAccessibilityWarning() {
        val enabled = isAccessibilityServiceEnabled()
        binding.accessibilityWarning.visibility = if (enabled) android.view.View.GONE else android.view.View.VISIBLE
        binding.enableAccessibilityButton.visibility = if (enabled) android.view.View.GONE else android.view.View.VISIBLE
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedComponent = "$packageName/${RemoteAccessibilityService::class.java.canonicalName}"
        val enabledServices = Settings.Secure.getString(
            contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabledServices)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expectedComponent, ignoreCase = true)) return true
        }
        return false
    }

    private fun showSettingsDialog() {
        val dialogBinding = DialogSettingsBinding.inflate(LayoutInflater.from(this))
        dialogBinding.serverUrlInput.setText(prefs.serverUrl)

        AlertDialog.Builder(this)
            .setTitle(R.string.btn_settings)
            .setView(dialogBinding.root)
            .setPositiveButton("Save") { _, _ ->
                val newUrl = dialogBinding.serverUrlInput.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    prefs.serverUrl = newUrl
                    binding.serverUrlText.text = newUrl
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
