package com.remotedroid.app.util

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lists launchable installed applications and launches a chosen one by
 * package name. Used to fulfil "open YouTube / Chrome / Instagram / etc"
 * commands sent from the browser.
 */
object AppLauncher {
    private const val TAG = "AppLauncher"

    fun listLaunchableApps(context: Context): JSONArray {
        val pm = context.packageManager
        val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val resolveInfos = pm.queryIntentActivities(mainIntent, 0)
        val result = JSONArray()

        for (info in resolveInfos) {
            try {
                val appInfo: ApplicationInfo = info.activityInfo.applicationInfo
                val label = pm.getApplicationLabel(appInfo).toString()
                val packageName = appInfo.packageName
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                result.put(JSONObject().apply {
                    put("packageName", packageName)
                    put("label", label)
                    put("isSystem", isSystem)
                })
            } catch (e: Exception) {
                Log.w(TAG, "Failed to read app info", e)
            }
        }
        return result
    }

    fun launchApp(context: Context, packageName: String): Boolean {
        val pm = context.packageManager
        val launchIntent = pm.getLaunchIntentForPackage(packageName) ?: return false
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return try {
            context.startActivity(launchIntent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch $packageName", e)
            false
        }
    }
}
