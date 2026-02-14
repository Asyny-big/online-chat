package ru.govchat.app.core.permission

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

@Stable
class GovChatPermissionFlow internal constructor(
    private val controller: GovChatPermissionController,
    private val activity: Activity?,
    private val singleLauncher: ActivityResultLauncher<String>,
    private val multipleLauncher: ActivityResultLauncher<Array<String>>
) {
    private var pendingFeature: GovChatPermissionFeature? by mutableStateOf(null)
    private var pendingPermissions: List<String> by mutableStateOf(emptyList())
    private var callback: ((GovChatPermissionResult) -> Unit)? by mutableStateOf(null)

    fun isGranted(feature: GovChatPermissionFeature): Boolean = controller.isGranted(feature)

    fun request(feature: GovChatPermissionFeature, onResult: (GovChatPermissionResult) -> Unit) {
        val missing = controller.missingPermissions(feature)
        if (missing.isEmpty()) {
            onResult(GovChatPermissionResult(granted = true, permanentlyDenied = false, deniedPermissions = emptyList()))
            return
        }

        pendingFeature = feature
        pendingPermissions = missing
        callback = onResult

        if (missing.size == 1) {
            singleLauncher.launch(missing.first())
        } else {
            multipleLauncher.launch(missing.toTypedArray())
        }
    }

    fun openAppSettings() {
        controller.openAppSettings()
    }

    internal fun handleSingleResult(granted: Boolean) {
        finishRequest(grantedMap = mapOf(pendingPermissions.firstOrNull().orEmpty() to granted))
    }

    internal fun handleMultipleResult(grantMap: Map<String, Boolean>) {
        finishRequest(grantedMap = grantMap)
    }

    private fun finishRequest(grantedMap: Map<String, Boolean>) {
        val pending = pendingPermissions.filter { it.isNotBlank() }
        val denied = pending.filter { grantedMap[it] != true }
        val granted = denied.isEmpty()
        val permanentlyDenied = if (!granted && activity != null) {
            !controller.shouldShowRationale(activity, denied)
        } else {
            false
        }

        // Clear current request state before invoking callback.
        // Callback may immediately start the next permission request in a chain.
        val currentCallback = callback
        pendingFeature = null
        pendingPermissions = emptyList()
        callback = null

        currentCallback?.invoke(
            GovChatPermissionResult(
                granted = granted,
                permanentlyDenied = permanentlyDenied,
                deniedPermissions = denied
            )
        )
    }
}

@Composable
fun rememberGovChatPermissionFlow(): GovChatPermissionFlow {
    val context = LocalContext.current
    val activity = context.findActivity()
    val controller = remember(context.applicationContext) {
        GovChatPermissionController(appContext = context.applicationContext)
    }

    val flowHolder = remember { mutableStateOf<GovChatPermissionFlow?>(null) }
    val singleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        flowHolder.value?.handleSingleResult(granted)
    }
    val multipleLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { grantMap ->
        flowHolder.value?.handleMultipleResult(grantMap)
    }

    val flow = remember(controller, activity, singleLauncher, multipleLauncher) {
        GovChatPermissionFlow(
            controller = controller,
            activity = activity,
            singleLauncher = singleLauncher,
            multipleLauncher = multipleLauncher
        )
    }
    flowHolder.value = flow

    return flow
}

private fun Context.findActivity(): Activity? {
    var current = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}
