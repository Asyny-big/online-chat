package ru.govchat.app.core.media

import android.content.Context
import android.net.Uri
import java.io.File

class TempMediaStore(
    appContext: Context,
    private val ttlMs: Long = DEFAULT_TTL_MS
) {

    private val rootDir = File(appContext.cacheDir, RECORDINGS_DIR_NAME).apply { mkdirs() }

    fun deleteLocalRecordingFile(uri: Uri) {
        val path = uri.path ?: return
        val file = File(path)
        if (!file.exists() || !file.isFile) return
        if (!isInsideManagedRoot(file)) return
        runCatching { file.delete() }
    }

    fun cleanupExpired(nowMs: Long = System.currentTimeMillis()) {
        if (!rootDir.exists() || !rootDir.isDirectory) return
        rootDir.walkTopDown()
            .filter { it.isFile }
            .forEach { file ->
                val ageMs = nowMs - file.lastModified()
                if (ageMs > ttlMs) {
                    runCatching { file.delete() }
                }
            }
    }

    private fun isInsideManagedRoot(file: File): Boolean {
        val rootCanonical = runCatching { rootDir.canonicalFile }.getOrNull() ?: return false
        val fileCanonical = runCatching { file.canonicalFile }.getOrNull() ?: return false
        return fileCanonical.path.startsWith(rootCanonical.path + File.separator)
    }

    private companion object {
        const val RECORDINGS_DIR_NAME = "recordings"
        const val DEFAULT_TTL_MS = 48L * 60L * 60L * 1000L
    }
}

