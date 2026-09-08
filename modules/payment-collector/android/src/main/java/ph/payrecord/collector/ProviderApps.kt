package ph.payrecord.collector

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.security.MessageDigest

/**
 * Authoritative provider identification from PackageManager. The notification's
 * title/app name is never trusted. Signing certificates are recorded for
 * provenance; a mismatch against a known pin (when configured) disables
 * collection for that provider rather than guessing.
 */
object ProviderApps {
  data class Info(
    val provider: String,
    val packageName: String,
    val versionName: String?,
    val versionCode: Long?,
    val signingCertSha256: String?,
    val installed: Boolean,
  )

  /** Same allowlist as packages/receipt-parsers registry.ts (keep in sync; parity test in docs/testing.md). */
  val PACKAGES: Map<String, String> = mapOf(
    "com.globe.gcash.android" to "GCASH",
    "com.gotyme.gotymebank" to "GOTYME",
    "ph.gotyme.app" to "GOTYME",
    // Maya is identifiable but has no notification adapter yet, so its
    // notifications are dropped by NotificationParser rather than uploaded.
    "com.paymaya" to "MAYA",
    // MariBank PH kept SeaBank's package through the 2025 rebrand.
    "ph.seabank.seabank" to "MARIBANK",
  )

  /**
   * Optional signing-certificate pins (SHA-256 hex, lowercase). Empty = record only.
   * Populate from a verified install before release; see docs/provider-support-matrix.md.
   */
  val KNOWN_SIGNERS: Map<String, Set<String>> = emptyMap()

  fun providerFor(packageName: String): String? = PACKAGES[packageName]

  fun detectAll(context: Context): List<Info> = PACKAGES.map { (pkg, provider) -> inspect(context, pkg, provider) }

  fun inspect(context: Context, packageName: String, provider: String): Info {
    val pm = context.packageManager
    return try {
      val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else 0
      val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
      } else {
        @Suppress("DEPRECATION") pm.getPackageInfo(packageName, flags)
      }
      val code = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pi.longVersionCode else @Suppress("DEPRECATION") pi.versionCode.toLong()
      val cert = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
        pi.signingInfo?.apkContentsSigners?.firstOrNull()?.toByteArray()?.let { sha256Hex(it) }
      } else null
      Info(provider, packageName, pi.versionName, code, cert, true)
    } catch (e: PackageManager.NameNotFoundException) {
      Info(provider, packageName, null, null, null, false)
    }
  }

  /** True when no pin is configured for the package or the observed cert matches a pin. */
  fun signerAcceptable(info: Info): Boolean {
    val pins = KNOWN_SIGNERS[info.packageName] ?: return true
    return info.signingCertSha256 != null && pins.contains(info.signingCertSha256)
  }

  fun sha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
}
