package ru.govchat.app.core.file

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.MimeTypeMap
import ru.govchat.app.BuildConfig
import ru.govchat.app.domain.model.MessageAttachment
import ru.govchat.app.domain.model.MessageType
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class GovChatAttachmentDownloader(
    context: Context
) {
    private val appContext = context.applicationContext
    private val downloadManager = appContext.getSystemService(DownloadManager::class.java)
    private val openAfterDownload = ConcurrentHashMap<Long, String>()
    private val receiverRegistered = AtomicBoolean(false)

    fun download(messageType: MessageType, attachment: MessageAttachment): Result<Long> {
        val rawUrl = attachment.url.trim()
        if (rawUrl.isBlank()) {
            return Result.failure(IllegalArgumentException("Пустая ссылка на файл"))
        }
        val resolvedUrl = resolveAttachmentUrl(rawUrl)
        val fileName = sanitizeFileName(
            attachment.originalName.ifBlank { defaultName(messageType, attachment.mimeType) }
        )
        val mimeType = attachment.mimeType?.takeIf { it.isNotBlank() }
            ?: inferMimeType(fileName, messageType)
        val targetPath = "GovChat/$fileName"

        val request = DownloadManager.Request(Uri.parse(resolvedUrl))
            .setTitle(fileName)
            .setMimeType(mimeType)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, targetPath)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val downloadId = runCatching { downloadManager.enqueue(request) }.getOrElse { error ->
            return Result.failure(error)
        }

        if (messageType == MessageType.Image) {
            registerReceiverIfNeeded()
            openAfterDownload[downloadId] = mimeType ?: "image/*"
        }

        return Result.success(downloadId)
    }

    private fun registerReceiverIfNeeded() {
        if (!receiverRegistered.compareAndSet(false, true)) return

        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            appContext.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            appContext.registerReceiver(downloadReceiver, filter)
        }
    }

    private val downloadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
            if (id <= 0L) return

            val mimeType = openAfterDownload.remove(id) ?: return
            val uri = runCatching { downloadManager.getUriForDownloadedFile(id) }.getOrNull() ?: return

            val viewIntent = Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, mimeType)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)

            runCatching { appContext.startActivity(viewIntent) }
        }
    }

    private fun resolveAttachmentUrl(rawUrl: String): String {
        if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
            return rawUrl
        }

        val normalized = if (rawUrl.startsWith("/")) rawUrl else "/$rawUrl"
        val apiBase = BuildConfig.API_BASE_URL.trimEnd('/')
        val hostBase = apiBase.removeSuffix("/api")

        return when {
            normalized.startsWith("/api/uploads/") -> "$hostBase$normalized"
            normalized.startsWith("/uploads/") -> "$apiBase$normalized"
            else -> "$hostBase$normalized"
        }
    }

    private fun inferMimeType(fileName: String, messageType: MessageType): String {
        val extension = fileName.substringAfterLast('.', "").lowercase()
        val guessed = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
        if (!guessed.isNullOrBlank()) return guessed

        return when (messageType) {
            MessageType.Image -> "image/*"
            MessageType.Video -> "video/*"
            MessageType.Audio -> "audio/*"
            else -> "application/octet-stream"
        }
    }

    private fun defaultName(type: MessageType, mimeType: String?): String {
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
            ?.takeIf { it.isNotBlank() }
            ?.let { ".$it" }
            ?: ""
        val base = when (type) {
            MessageType.Image -> "image"
            MessageType.Video -> "video"
            MessageType.Audio -> "audio"
            MessageType.File -> "file"
            MessageType.System -> "system"
            MessageType.Text -> "message"
        }
        return "${base}_${System.currentTimeMillis()}$ext"
    }

    private fun sanitizeFileName(name: String): String {
        val normalized = name.trim().ifBlank { "file_${System.currentTimeMillis()}" }
        return normalized
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .replace(Regex("\\s+"), " ")
            .let { File(it).name }
    }
}
