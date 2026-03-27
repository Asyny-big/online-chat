package ru.govchat.app.core.update

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import java.io.File

class AppUpdateDownloadManager(
    context: Context
) {
    private val appContext = context.applicationContext
    private val downloadManager = requireNotNull(
        appContext.getSystemService(DownloadManager::class.java)
    ) { "DownloadManager is not available" }

    fun enqueue(updateInfo: AppUpdateInfo): Result<PersistedAppUpdateDownload> {
        val apkFile = apkFileFor(updateInfo)
        apkFile.parentFile?.mkdirs()
        if (apkFile.exists()) {
            apkFile.delete()
        }

        val request = DownloadManager.Request(Uri.parse(resolveApkUrl(updateInfo.apkUrl)))
            .setTitle("GovChat ${updateInfo.latestVersion}")
            .setDescription("Загрузка обновления приложения")
            .setMimeType(APK_MIME_TYPE)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationUri(Uri.fromFile(apkFile))
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val downloadId = runCatching { downloadManager.enqueue(request) }.getOrElse { error ->
            return Result.failure(error)
        }

        return Result.success(
            PersistedAppUpdateDownload(
                downloadId = downloadId,
                versionCode = updateInfo.latestVersionCode,
                apkPath = apkFile.absolutePath
            )
        )
    }

    fun query(downloadId: Long): AppUpdateDownloadSnapshot? {
        val query = DownloadManager.Query().setFilterById(downloadId)
        downloadManager.query(query)?.use { cursor ->
            if (!cursor.moveToFirst()) return null
            return AppUpdateDownloadSnapshot(
                status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
                reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
                bytesDownloaded = cursor.getLong(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                ),
                totalBytes = cursor.getLong(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)
                ),
                localUri = cursor.getString(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI)
                )
            )
        }
        return null
    }

    fun remove(downloadId: Long) {
        runCatching { downloadManager.remove(downloadId) }
    }

    fun apkFileFor(updateInfo: AppUpdateInfo): File {
        val safeVersion = updateInfo.latestVersion
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .ifBlank { updateInfo.latestVersionCode.toString() }
        val updatesDir = File(
            appContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS),
            "updates"
        )
        return File(updatesDir, "govchat-$safeVersion.apk")
    }

    private fun resolveApkUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed
        }

        val normalized = if (trimmed.startsWith("/")) trimmed else "/$trimmed"
        val apiBase = ru.govchat.app.BuildConfig.API_BASE_URL.trimEnd('/')
        val hostBase = apiBase.removeSuffix("/api")
        return when {
            normalized.startsWith("/api/") -> "$hostBase$normalized"
            else -> "$apiBase$normalized"
        }
    }

    companion object {
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}
