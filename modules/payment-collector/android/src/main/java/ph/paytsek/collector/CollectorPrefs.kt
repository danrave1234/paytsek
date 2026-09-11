package ph.paytsek.collector

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

/**
 * Keystore-backed configuration store for the collector credential and bindings.
 * Never store notification text here.
 */
class CollectorPrefs(context: Context) {
  private val prefs: SharedPreferences

  init {
    val masterKey = MasterKey.Builder(context, "paytsek_collector_master")
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()
    prefs = EncryptedSharedPreferences.create(
      context,
      "paytsek_collector_secure",
      masterKey,
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )
  }

  var apiBaseUrl: String?
    get() = prefs.getString("apiBaseUrl", null)
    set(v) = prefs.edit().putString("apiBaseUrl", v).apply()

  var credential: String?
    get() = prefs.getString("credential", null)
    set(v) = prefs.edit().putString("credential", v).apply()

  var deviceId: String?
    get() = prefs.getString("deviceId", null)
    set(v) = prefs.edit().putString("deviceId", v).apply()

  var enabledProviders: Set<String>
    get() = prefs.getStringSet("enabledProviders", emptySet()) ?: emptySet()
    set(v) = prefs.edit().putStringSet("enabledProviders", v).apply()

  var paused: Boolean
    get() = prefs.getBoolean("paused", false)
    set(v) = prefs.edit().putBoolean("paused", v).apply()

  /**
   * Opt-in capture of unrecognised notification shapes (redacted, local only).
   * Off unless the owner turns it on; see TemplateSamples.
   */
  var captureUnknownTemplates: Boolean
    get() = prefs.getBoolean("captureUnknownTemplates", false)
    set(v) = prefs.edit().putBoolean("captureUnknownTemplates", v).apply()

  var unknownTemplateCount: Long
    get() = prefs.getLong("unknownTemplateCount", 0)
    set(v) = prefs.edit().putLong("unknownTemplateCount", v).apply()

  var lastObservedEventAt: String?
    get() = prefs.getString("lastObservedEventAt", null)
    set(v) = prefs.edit().putString("lastObservedEventAt", v).apply()

  var lastUploadAt: String?
    get() = prefs.getString("lastUploadAt", null)
    set(v) = prefs.edit().putString("lastUploadAt", v).apply()

  var lastUploadError: String?
    get() = prefs.getString("lastUploadError", null)
    set(v) = prefs.edit().putString("lastUploadError", v).apply()

  var listenerConnected: Boolean
    get() = prefs.getBoolean("listenerConnected", false)
    set(v) = prefs.edit().putBoolean("listenerConnected", v).apply()

  /** Random id per boot session so monotonic timestamps can be compared safely. */
  val bootSessionId: String
    get() {
      val key = "bootSession:" + android.os.SystemClock.elapsedRealtime().let { bootEpochBucket() }
      return prefs.getString(key, null) ?: UUID.randomUUID().toString().also { prefs.edit().putString(key, it).apply() }
    }

  private fun bootEpochBucket(): Long = (System.currentTimeMillis() - android.os.SystemClock.elapsedRealtime()) / 60_000

  val isConfigured: Boolean get() = !credential.isNullOrEmpty() && !apiBaseUrl.isNullOrEmpty()

  fun clear() = prefs.edit().clear().apply()
}
