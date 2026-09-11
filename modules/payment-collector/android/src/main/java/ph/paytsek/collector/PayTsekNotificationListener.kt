package ph.paytsek.collector

import android.app.Notification
import android.os.SystemClock
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject
import java.util.UUID

/**
 * Real NotificationListenerService. Runs independently of React Native JS.
 *
 * Pipeline per posted notification:
 *  1. gate: configured, not paused, package allowlisted AND provider enabled by the owner's binding
 *  2. parse on-device (reject-first); rejected content is never stored
 *  3. persist canonical event + outbox row (encrypted) BEFORE returning
 *  4. enqueue WorkManager upload (expedited best-effort, network constraint, backoff)
 *
 * Reposts/updates of the same notification map to the same lifecycle key and
 * never create a second event. Group summaries are ignored.
 */
class PayTsekNotificationListener : NotificationListenerService() {

  private lateinit var prefs: CollectorPrefs
  private lateinit var outbox: OutboxDb

  override fun onCreate() {
    super.onCreate()
    prefs = CollectorPrefs(this)
    outbox = OutboxDb(this)
  }

  override fun onListenerConnected() {
    prefs.listenerConnected = true
    // Recovery attempt only: enumerate active notifications (deduplicated). Not history.
    try { activeNotifications?.forEach { handle(it, recovery = true) } } catch (_: Throwable) {}
    UploadWorker.enqueue(this, expedited = false)
    // Report listener health even when no payment arrives. This separates an
    // inactive wallet from a broken Android listener in the record UI.
    HealthWorker.enqueue(this)
    HealthWorker.schedule(this)
  }

  override fun onListenerDisconnected() {
    prefs.listenerConnected = false
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    handle(sbn, recovery = false)
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) { /* removal is not evidence of anything */ }

  private fun handle(sbn: StatusBarNotification, recovery: Boolean) {
    if (!prefs.isConfigured || prefs.paused) return
    val provider = ProviderApps.providerFor(sbn.packageName) ?: return
    if (!prefs.enabledProviders.contains(provider)) return
    val appInfo = ProviderApps.inspect(this, sbn.packageName, provider)
    if (!appInfo.installed || !ProviderApps.signerAcceptable(appInfo)) return

    val n = sbn.notification ?: return
    val isSummary = (n.flags and Notification.FLAG_GROUP_SUMMARY) != 0
    val extras = n.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString()
    val bigText = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
    val lines = extras?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.map { it.toString() } ?: emptyList()

    val result = NotificationParser.parse(NotificationParser.Input(sbn.packageName, title, text, bigText, lines, isSummary))
    val parsed = when (result) {
      is NotificationParser.Result.Rejected -> {
        if (result.reason == "UNKNOWN_TEMPLATE") prefs.unknownTemplateCount = prefs.unknownTemplateCount + 1
        // Opt-in only, and only for shapes we failed to recognise — never for
        // anything classified as OTP/security, outgoing, promo or failed.
        if (prefs.captureUnknownTemplates && TemplateSamples.isCaptureEligible(result.reason)) {
          runCatching {
            TemplateSamples.insert(
              context = this,
              packageName = sbn.packageName,
              provider = provider,
              title = title,
              text = text,
              bigText = bigText,
              lines = lines,
              appVersionName = appInfo.versionName,
              capturedAt = Iso.of(System.currentTimeMillis()),
            )
          }
        }
        return
      }
      is NotificationParser.Result.Accepted -> result.event
    }

    // Lifecycle dedup key: stable across reposts/updates of the same notification.
    val lifecycleKey = ProviderApps.sha256Hex(
      "${sbn.packageName}|${sbn.key}|${sbn.tag ?: ""}|${sbn.id}|${parsed.amountCentavos}|${parsed.referenceValue ?: ""}".toByteArray(),
    )
    val nowMs = System.currentTimeMillis()
    val payload = JSONObject().apply {
      put("clientEventId", UUID.randomUUID().toString())
      put("provider", parsed.provider)
      put("sourcePackage", sbn.packageName)
      put("sourceAppVersionName", appInfo.versionName ?: JSONObject.NULL)
      put("sourceAppVersionCode", appInfo.versionCode?.toInt() ?: JSONObject.NULL)
      put("parserId", parsed.parserId)
      put("parserVersion", parsed.parserVersion)
      put("paymentRail", parsed.paymentRail)
      put("currency", "PHP")
      put("amountCentavos", parsed.amountCentavos)
      put("referenceNamespace", parsed.referenceNamespace)
      put("referenceValue", parsed.referenceValue ?: JSONObject.NULL)
      put("payerMaskedName", parsed.payerMaskedName ?: JSONObject.NULL)
      put("payerMaskedPhone", parsed.payerMaskedPhone ?: JSONObject.NULL)
      put("providerDescribedAt", parsed.providerDescribedAt ?: JSONObject.NULL)
      put("notificationWhenAt", if (n.`when` > 0) Iso.of(n.`when`) else JSONObject.NULL)
      put("postedAt", Iso.of(sbn.postTime))
      put("capturedAt", Iso.of(nowMs))
      put("monotonicCaptureMs", SystemClock.elapsedRealtime())
      put("bootSessionId", prefs.bootSessionId)
      put("lifecycleDedupKey", lifecycleKey)
      put("normalizedTextSha256", parsed.normalizedTextSha256)
      put("wasGroupChild", (n.group != null && !isSummary))
    }
    val inserted = outbox.insertIfNew(
      OutboxDb.Item(
        clientEventId = payload.getString("clientEventId"),
        payloadJson = payload.toString(),
        lifecycleDedupKey = lifecycleKey,
        postedAt = payload.getString("postedAt"),
        attempts = 0,
        acknowledged = false,
        outcome = null,
      ),
    )
    if (!inserted) return // repost/update of a known notification
    prefs.lastObservedEventAt = Iso.of(nowMs)
    UploadWorker.enqueue(this, expedited = !recovery)
  }
}
