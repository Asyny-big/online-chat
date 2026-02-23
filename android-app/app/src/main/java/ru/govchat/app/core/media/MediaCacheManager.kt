package ru.govchat.app.core.media

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.database.DatabaseProvider
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File
import java.util.concurrent.ConcurrentHashMap

object MediaCacheManager {

    private const val CACHE_DIR = "media"
    private const val MAX_CACHE_BYTES = 200L * 1024L * 1024L
    private const val PREFETCH_BYTES = 4L * 1024L * 1024L

    @Volatile
    private var cache: SimpleCache? = null

    @Volatile
    private var databaseProvider: DatabaseProvider? = null

    private val prefetchingUrls = ConcurrentHashMap.newKeySet<String>()
    private val prefetchScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun createPlayer(context: Context): ExoPlayer {
        val appContext = context.applicationContext
        return ExoPlayer.Builder(appContext)
            .setMediaSourceFactory(DefaultMediaSourceFactory(buildCacheDataSourceFactory(appContext)))
            .build()
    }

    fun mediaItem(url: String): MediaItem = MediaItem.fromUri(url)

    fun prefetch(context: Context, url: String) {
        val safeUrl = url.trim()
        if (safeUrl.isBlank()) return
        if (!prefetchingUrls.add(safeUrl)) return

        val appContext = context.applicationContext
        prefetchScope.launch {
            try {
                val dataSource = buildCacheDataSourceFactory(appContext).createDataSource()
                val dataSpec = DataSpec.Builder()
                    .setUri(Uri.parse(safeUrl))
                    .setPosition(0L)
                    .setLength(PREFETCH_BYTES)
                    .build()
                CacheWriter(dataSource, dataSpec, null, null).cache()
            } catch (_: Throwable) {
                // Best-effort prefetch.
            } finally {
                prefetchingUrls.remove(safeUrl)
            }
        }
    }

    private fun buildCacheDataSourceFactory(context: Context): CacheDataSource.Factory {
        val appContext = context.applicationContext
        return CacheDataSource.Factory()
            .setCache(getCache(appContext))
            .setUpstreamDataSourceFactory(
                DefaultHttpDataSource.Factory()
                    .setAllowCrossProtocolRedirects(true)
            )
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    private fun getCache(context: Context): SimpleCache {
        val existing = cache
        if (existing != null) return existing

        synchronized(this) {
            val recheck = cache
            if (recheck != null) return recheck

            val appContext = context.applicationContext
            val provider = databaseProvider ?: StandaloneDatabaseProvider(appContext).also {
                databaseProvider = it
            }
            val cacheDir = File(appContext.cacheDir, CACHE_DIR).apply { mkdirs() }
            return SimpleCache(
                cacheDir,
                LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES),
                provider
            ).also { cache = it }
        }
    }
}
