package ru.govchat.app.core.update

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

class AppUpdateIntegrityVerifier(
    context: Context
) {
    private val appContext = context.applicationContext
    private val packageManager = appContext.packageManager

    suspend fun verify(file: File, updateInfo: AppUpdateInfo): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(file.exists() && file.length() > 0L) { "APK файл не найден или пуст" }

            updateInfo.apkSha256?.let { expected ->
                val actual = sha256(file)
                require(actual.equals(expected, ignoreCase = true)) {
                    "Контрольная сумма APK не совпадает"
                }
            }

            val archiveInfo = requireNotNull(getArchivePackageInfo(file.absolutePath)) {
                "Не удалось прочитать метаданные APK"
            }

            require(archiveInfo.packageName == appContext.packageName) {
                "Пакет обновления не принадлежит GovChat"
            }

            val archiveVersionCode = PackageInfoCompat.getLongVersionCode(archiveInfo)
            require(archiveVersionCode >= updateInfo.latestVersionCode) {
                "Версия загруженного APK устарела"
            }

            val archiveDigests = signatureDigests(archiveInfo)
            val installedDigests = installedSignatureDigests()

            if (archiveDigests.isNotEmpty() && installedDigests.isNotEmpty()) {
                require(archiveDigests.any { it in installedDigests }) {
                    "Подпись APK не совпадает с установленным приложением"
                }
            }

            if (updateInfo.signingCertSha256.isNotEmpty()) {
                require(archiveDigests.any { digest -> digest in updateInfo.signingCertSha256 }) {
                    "Сертификат подписи APK не прошёл проверку"
                }
            }
        }
    }

    private fun installedSignatureDigests(): Set<String> {
        val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageInfo(
                appContext.packageName,
                PackageManager.PackageInfoFlags.of(signingFlags().toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageInfo(appContext.packageName, signingFlags())
        }
        return signatureDigests(packageInfo)
    }

    private fun getArchivePackageInfo(apkPath: String): PackageInfo? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.getPackageArchiveInfo(
                apkPath,
                PackageManager.PackageInfoFlags.of(signingFlags().toLong())
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.getPackageArchiveInfo(apkPath, signingFlags())
        }
    }

    @Suppress("DEPRECATION")
    private fun signatureDigests(packageInfo: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val signingInfo = packageInfo.signingInfo ?: return emptySet()
            val rows = if (signingInfo.hasMultipleSigners()) {
                signingInfo.apkContentsSigners
            } else {
                signingInfo.signingCertificateHistory
            }
            rows.orEmpty().map { it.toByteArray() }
        } else {
            packageInfo.signatures.orEmpty().map { it.toByteArray() }
        }

        return signatures.mapTo(LinkedHashSet()) { bytes ->
            bytes.sha256Hex()
        }
    }

    private fun signingFlags(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }
    }

    private fun sha256(file: File): String {
        FileInputStream(file).use { input ->
            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
            return digest.digest().sha256Hex()
        }
    }

    private fun ByteArray.sha256Hex(): String {
        return joinToString(separator = "") { byte -> "%02x".format(byte) }
    }
}
