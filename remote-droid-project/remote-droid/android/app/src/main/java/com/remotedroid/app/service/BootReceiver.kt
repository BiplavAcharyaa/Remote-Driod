package com.remotedroid.app.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Registered for BOOT_COMPLETED but intentionally takes no action. Remote
 * control sessions require an explicit, freshly-granted MediaProjection
 * permission (Android does not allow silently resuming a MediaProjection
 * grant after reboot, and Remote Droid does not attempt to auto-start
 * screen sharing without the user present) plus renewed pairing. This
 * receiver exists only as a placeholder so future opt-in "resume on boot"
 * behavior can be added without a manifest change; today it only logs.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.i("BootReceiver", "Boot completed — Remote Droid requires manual session start for security.")
        }
    }
}
