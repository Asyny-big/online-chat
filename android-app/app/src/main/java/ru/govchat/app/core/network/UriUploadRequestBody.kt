package ru.govchat.app.core.network

import android.content.ContentResolver
import android.net.Uri
import okhttp3.MediaType
import okhttp3.RequestBody
import okio.BufferedSink
import java.io.IOException

class UriUploadRequestBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mediaType: MediaType?,
    private val contentLength: Long,
    private val onProgress: (writtenBytes: Long, totalBytes: Long) -> Unit
) : RequestBody() {

    override fun contentType(): MediaType? = mediaType

    override fun contentLength(): Long = contentLength

    @Throws(IOException::class)
    override fun writeTo(sink: BufferedSink) {
        contentResolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            var uploaded = 0L
            while (true) {
                val read = input.read(buffer)
                if (read == -1) break
                sink.write(buffer, 0, read)
                uploaded += read
                onProgress(uploaded, contentLength)
            }
        } ?: throw IOException("Unable to open input stream for $uri")
    }
}
