package ru.govchat.app.core.permission

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class GovChatPermissionController(
    private val appContext: Context,
    private val sdkInt: Int = Build.VERSION.SDK_INT
) {

    fun requiredPermissions(feature: GovChatPermissionFeature): List<String> {
        return when (feature) {
            GovChatPermissionFeature.Camera -> listOf(Manifest.permission.CAMERA)
            GovChatPermissionFeature.Microphone -> listOf(Manifest.permission.RECORD_AUDIO)
            GovChatPermissionFeature.MediaRead -> {
                if (sdkInt >= Build.VERSION_CODES.TIRAMISU) {
                    listOf(
                        Manifest.permission.READ_MEDIA_IMAGES,
                        Manifest.permission.READ_MEDIA_VIDEO
                    )
                } else {
                    listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
                }
            }

            GovChatPermissionFeature.Notifications -> {
                if (sdkInt >= Build.VERSION_CODES.TIRAMISU) {
                    listOf(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    emptyList()
                }
            }
        }
    }

    fun missingPermissions(feature: GovChatPermissionFeature): List<String> {
        return requiredPermissions(feature).filter { permission ->
            ContextCompat.checkSelfPermission(appContext, permission) != PackageManager.PERMISSION_GRANTED
        }
    }

    fun isGranted(feature: GovChatPermissionFeature): Boolean {
        return missingPermissions(feature).isEmpty()
    }

    fun shouldShowRationale(activity: Activity, permissions: List<String>): Boolean {
        return permissions.any { permission ->
            ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
        }
    }

    fun openAppSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", appContext.packageName, null)
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        appContext.startActivity(intent)
    }
}
