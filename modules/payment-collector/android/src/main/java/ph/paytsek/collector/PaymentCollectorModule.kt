package ph.paytsek.collector

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody

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
  private val outbox by lazy { OutboxDb.getInstance(context) }

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
        "configured" to prefs.isConfigured,
        "notificationAccessGranted" to NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName),
        "listenerConnected" to prefs.listenerConnected,
        "enabledProviders" to prefs.enabledProviders.toList().sorted(),
        "pendingUploadCount" to outbox.pendingCount(),
        "lastObservedEventAt" to prefs.lastObservedEventAt,
        "lastUploadAt" to prefs.lastUploadAt,
        "lastUploadError" to prefs.lastUploadError,
        "unknownTemplateCount" to prefs.unknownTemplateCount.toInt(),
        "droppedEventCount" to outbox.droppedEventCount().toInt(),
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
        android.service.notification.NotificationListenerService.requestRebind(ComponentName(context, PayTsekNotificationListener::class.java))
      } catch (_: Throwable) {}
      UploadWorker.enqueue(context, expedited = false)
      HealthWorker.enqueue(context)
      HealthWorker.schedule(context)
    }

    // Restore provider filters after an app upgrade without moving or
    // re-exposing the Keystore-backed collector credential to JavaScript.
    AsyncFunction("setEnabledProviders") { providers: List<String> ->
      prefs.enabledProviders = providers.toSet()
      try {
        android.service.notification.NotificationListenerService.requestRebind(ComponentName(context, PayTsekNotificationListener::class.java))
      } catch (_: Throwable) {}
    }

    AsyncFunction("clearConfiguration") {
      prefs.clear()
    }

    /** Opt-in capture of unrecognised notification shapes (redacted, local only). */
    AsyncFunction("setCaptureUnknownTemplates") { enabled: Boolean ->
      prefs.captureUnknownTemplates = enabled
      if (!enabled) TemplateSamples.clear(context)
    }

    AsyncFunction("isCaptureUnknownTemplates") { prefs.captureUnknownTemplates }

    AsyncFunction("listTemplateSamples") {
      TemplateSamples.list(context).map { s ->
        mapOf(
          "id" to s.id.toInt(),
          "packageName" to s.packageName,
          "provider" to s.provider,
          "title" to s.title,
          "text" to s.text,
          "bigText" to s.bigText,
          "lines" to s.lines,
          "appVersionName" to s.appVersionName,
          "capturedAt" to s.capturedAt,
        )
      }
    }

    AsyncFunction("exportTemplateSamples") { TemplateSamples.exportJson(context) }

    AsyncFunction("clearTemplateSamples") { TemplateSamples.clear(context) }

    AsyncFunction("setPaused") { paused: Boolean ->
      prefs.paused = paused
      if (!paused) UploadWorker.enqueue(context, expedited = false)
    }

    AsyncFunction("flushNow") {
      val attempted = outbox.pendingCount()
      // Run the upload loop inline so the server has notifications before
      // the record is created, enabling instant inline matching.
      val acknowledged = runBlocking { UploadRunner.uploadPending(context, waitForAcks = true) }
      // Also enqueue WorkManager as a backup for any remaining pending rows.
      UploadWorker.enqueue(context, expedited = true)
      mapOf("attempted" to attempted, "acknowledged" to acknowledged)
    }

    /** Content-free heartbeat to /v1/collector/health using the natively stored credential. */
    AsyncFunction("reportHealth") {
      val baseUrl = prefs.apiBaseUrl
      val credential = prefs.credential
      if (baseUrl.isNullOrEmpty() || credential.isNullOrEmpty()) return@AsyncFunction false
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
        .url(baseUrl.trimEnd('/') + "/v1/collector/health")
        .header("Authorization", "Collector " + credential)
        .header("x-paytsek-api-version", "v1")
        .post(body.toString().toRequestBody("application/json".toMediaType()))
        .build()
      try { okhttp3.OkHttpClient().newCall(req).execute().use { it.isSuccessful } } catch (_: Throwable) { false }
    }

    /**
     * Posts a local notification that mimics a real GCash incoming-money push so
     * the owner can verify the listener end-to-end. The payer is pre-masked and
     * there is deliberately no Ref No., so a test can only ever produce a
     * Possible match — never an automatic Strong match.
     */
    AsyncFunction("postTestNotification") {
      val manager = NotificationManagerCompat.from(context)
      // Covers both the Android 13+ POST_NOTIFICATIONS runtime permission and
      // notifications being blocked app-wide on older versions.
      if (!manager.areNotificationsEnabled()) {
        return@AsyncFunction mapOf("posted" to false, "reason" to "PERMISSION", "amountCentavos" to null, "text" to null)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        manager.createNotificationChannel(NotificationChannel("paytsek_test", "Listener test", NotificationManager.IMPORTANCE_DEFAULT))
      }
      val amountCentavos = (5_000L..99_999L).random()
      val text = String.format(
        java.util.Locale.US,
        "You have received PHP %d.%02d of GCash from JU\u2022N D. 0917\u2022\u2022\u2022\u2022123.",
        amountCentavos / 100,
        amountCentavos % 100,
      )
      val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.stat_notify_chat
      val notification = NotificationCompat.Builder(context, "paytsek_test")
        .setSmallIcon(icon)
        .setContentTitle("You have received money in GCash!")
        .setContentText(text)
        .addExtras(Bundle().apply { putBoolean(PayTsekNotificationListener.EXTRA_TEST_GCASH, true) })
        .build()
      manager.notify((System.currentTimeMillis() and 0x7FFFFFFF).toInt(), notification)
      mapOf("posted" to true, "reason" to null, "amountCentavos" to amountCentavos.toInt(), "text" to text)
    }

    /**
     * Returns pending and recently acknowledged notification events for local
     * matching. Includes events uploaded within the last 3 days so the local
     * cache retains events already ingested by the server. Only matching-relevant
     * fields are exposed; raw notification text and unmasked payer data are
     * never included.
     */
    AsyncFunction("getPendingNotifications") {
      val items = outbox.recent(limit = 200, recentDays = 3)
      val out = java.util.ArrayList<Map<String, Any>>()
      for (item in items) {
        try {
          val payload = org.json.JSONObject(item.payloadJson)
          out.add(mapOf(
            "clientEventId" to payload.getString("clientEventId"),
            "provider" to payload.getString("provider"),
            "amountCentavos" to payload.optInt("amountCentavos", 0),
            "postedAt" to payload.getString("postedAt"),
            "providerDescribedAt" to (if (payload.isNull("providerDescribedAt")) org.json.JSONObject.NULL else payload.getString("providerDescribedAt")),
            "capturedAt" to payload.getString("capturedAt"),
          ))
        } catch (_: Throwable) {
          // Skip corrupted payloads
        }
      }
      out
    }

    AsyncFunction("recoverActiveNotifications") {
      try {
        android.service.notification.NotificationListenerService.requestRebind(ComponentName(context, PayTsekNotificationListener::class.java))
      } catch (_: Throwable) {}
      outbox.pendingCount()
    }
  }
}
