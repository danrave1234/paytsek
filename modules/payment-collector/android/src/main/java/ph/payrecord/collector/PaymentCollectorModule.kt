package ph.payrecord.collector

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class CollectorConfigRecord : Record {
  @Field var apiBaseUrl: String = ""
  @Field var credential: String = ""
  @Field var deviceId: String = ""
  @Field var enabledProviders: List<String> = emptyList()
}

/** Expo Modules API surface used by apps/mobile via `payment-collector`. */
class PaymentCollectorModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext) { "React context missing" }
  private val prefs by lazy { CollectorPrefs(context) }
  private val outbox by lazy { OutboxDb(context) }

  override fun definition() = ModuleDefinition {
    Name("PaymentCollector")

    Function("isSupported") { true }

    Function("isNotificationAccessGranted") {
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    Function("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("getStatus") {
      val appVersion = try { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "" } catch (_: Throwable) { "" }
      mapOf(
        "supported" to true,
        "notificationAccessGranted" to NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName),
        "listenerConnected" to prefs.listenerConnected,
        "pendingUploadCount" to outbox.pendingCount(),
        "lastObservedEventAt" to prefs.lastObservedEventAt,
        "lastUploadAt" to prefs.lastUploadAt,
        "lastUploadError" to prefs.lastUploadError,
        "unknownTemplateCount" to prefs.unknownTemplateCount.toInt(),
        "paused" to prefs.paused,
        "appVersion" to appVersion,
        "bootSessionId" to prefs.bootSessionId,
      )
    }

    AsyncFunction("detectProviderApps") {
      ProviderApps.detectAll(context).map {
        mapOf(
          "provider" to it.provider,
          "packageName" to it.packageName,
          "versionName" to it.versionName,
          "versionCode" to it.versionCode?.toInt(),
          "signingCertSha256" to it.signingCertSha256,
          "installed" to it.installed,
        )
      }
    }

    AsyncFunction("configure") { config: CollectorConfigRecord ->
      prefs.apiBaseUrl = config.apiBaseUrl
      prefs.credential = config.credential
      prefs.deviceId = config.deviceId
      prefs.enabledProviders = config.enabledProviders.toSet()
      prefs.paused = false
      // Ask the system to (re)bind the listener so onListenerConnected fires promptly.
      try {
        android.service.notification.NotificationListenerService.requestRebind(ComponentName(context, PayRecordNotificationListener::class.java))
      } catch (_: Throwable) {}
      UploadWorker.enqueue(context, expedited = false)
    }

    AsyncFunction("clearConfiguration") {
      prefs.clear()
    }

    AsyncFunction("setPaused") { paused: Boolean ->
      prefs.paused = paused
      if (!paused) UploadWorker.enqueue(context, expedited = false)
    }

    AsyncFunction("flushNow") {
      val attempted = outbox.pendingCount()
      UploadWorker.enqueue(context, expedited = true)
      mapOf("attempted" to attempted, "acknowledged" to 0)
    }

    /** Content-free heartbeat to /v1/collector/health using the natively stored credential. */
    AsyncFunction("reportHealth") {
      if (!prefs.isConfigured) return@AsyncFunction false
      val apps = org.json.JSONArray().apply {
        ProviderApps.detectAll(context).filter { it.installed }.forEach {
          put(org.json.JSONObject().apply {
            put("provider", it.provider); put("packageName", it.packageName)
            put("versionName", it.versionName ?: org.json.JSONObject.NULL); put("versionCode", it.versionCode?.toInt() ?: org.json.JSONObject.NULL)
          })
        }
      }
      val appVersion = try { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "" } catch (_: Throwable) { "" }
      val body = org.json.JSONObject().apply {
        put("appVersion", appVersion)
        put("listenerConnected", prefs.listenerConnected)
        put("notificationAccessGranted", NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName))
        put("pendingUploadCount", outbox.pendingCount())
        put("lastObservedEventAt", prefs.lastObservedEventAt ?: org.json.JSONObject.NULL)
        put("unknownTemplateCount", prefs.unknownTemplateCount.toInt())
        put("diagnosticReason", prefs.lastUploadError ?: org.json.JSONObject.NULL)
        put("providerApps", apps)
      }
      val req = okhttp3.Request.Builder()
        .url(prefs.apiBaseUrl!!.trimEnd('/') + "/v1/collector/health")
        .header("Authorization", "Collector " + prefs.credential!!)
        .header("x-payrecord-api-version", "v1")
        .post(okhttp3.RequestBody.create(okhttp3.MediaType.parse("application/json"), body.toString()))
        .build()
      try { okhttp3.OkHttpClient().newCall(req).execute().use { it.isSuccessful } } catch (_: Throwable) { false }
    }

    AsyncFunction("recoverActiveNotifications") {
      try {
        android.service.notification.NotificationListenerService.requestRebind(ComponentName(context, PayRecordNotificationListener::class.java))
      } catch (_: Throwable) {}
      outbox.pendingCount()
    }
  }
}
