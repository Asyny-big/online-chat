package ru.govchat.app.core.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import kotlin.coroutines.resume

class OnDemandLocationClient(
    context: Context
) {
    private val appContext = context.applicationContext
    private val fusedClient = LocationServices.getFusedLocationProviderClient(appContext)

    fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(
            appContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    fun isLocationEnabled(): Boolean {
        val manager = appContext.getSystemService(LocationManager::class.java) ?: return false
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                manager.isLocationEnabled
            } else {
                manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
                    manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            }
        }.getOrDefault(false)
    }

    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(): Result<DeviceLocation> {
        if (!hasLocationPermission()) {
            return Result.failure(LocationFailure("DEVICE_LOCATION_PERMISSION_DENIED"))
        }
        if (!isLocationEnabled()) {
            return Result.failure(LocationFailure("DEVICE_LOCATION_DISABLED"))
        }

        return suspendCancellableCoroutine { continuation ->
            val cancellationTokenSource = CancellationTokenSource()
            continuation.invokeOnCancellation {
                cancellationTokenSource.cancel()
            }

            val request = CurrentLocationRequest.Builder()
                .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
                .setMaxUpdateAgeMillis(0)
                .setDurationMillis(LOCATION_TIMEOUT_MS)
                .build()

            fusedClient.getCurrentLocation(request, cancellationTokenSource.token)
                .addOnSuccessListener { location ->
                    if (!continuation.isActive) return@addOnSuccessListener
                    if (location == null) {
                        continuation.resume(Result.failure(LocationFailure("DEVICE_LOCATION_UNAVAILABLE")))
                        return@addOnSuccessListener
                    }

                    val accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else -1.0
                    if (accuracy <= 0.0 || accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
                        continuation.resume(Result.failure(LocationFailure("DEVICE_LOCATION_LOW_ACCURACY")))
                        return@addOnSuccessListener
                    }

                    continuation.resume(
                        Result.success(
                            DeviceLocation(
                                latitude = location.latitude,
                                longitude = location.longitude,
                                accuracyMeters = accuracy,
                                altitudeMeters = location.altitude.takeIf { location.hasAltitude() },
                                headingDegrees = location.bearing.toDouble().takeIf { location.hasBearing() },
                                speedMetersPerSecond = location.speed.toDouble().takeIf { location.hasSpeed() },
                                provider = location.provider ?: "fused",
                                capturedAt = Instant.ofEpochMilli(location.time).toString()
                            )
                        )
                    )
                }
                .addOnFailureListener { error ->
                    if (!continuation.isActive) return@addOnFailureListener
                    continuation.resume(Result.failure(error))
                }
        }
    }

    private companion object {
        const val LOCATION_TIMEOUT_MS = 15_000L
        const val MAX_ACCEPTED_ACCURACY_METERS = 500.0
    }
}

data class DeviceLocation(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
    val altitudeMeters: Double?,
    val headingDegrees: Double?,
    val speedMetersPerSecond: Double?,
    val provider: String,
    val capturedAt: String
)

class LocationFailure(
    val code: String
) : IllegalStateException(code)
