package ph.paytsek.collector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * Uploads pending outbox items in bounded batches with per-item acknowledgement.
 * WorkManager provides persistence across process death/reboot, network
 * constraints and exponential backoff. Expedited execution is best-effort and
 * quota-limited by the OS; it is never treated as a guarantee.
 */
/**
 * Shared upload loop: POSTs pending outbox items in bounded batches with per-item
 * acknowledgement. Used by both the WorkManager worker (background) and flushNow
 * (inline, before record create) so the server has notifications before matching.
 */
object UploadRunner {
  private val client = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .build()

  /**
   * Upload all pending events. Returns the number of events acknowledged.
   * When [waitForAcks] is true, runs until all pending rows are acknowledged
   * or a server error stops the loop (used by flushNow for inline matching).
   */
  suspend fun uploadPending(context: Context, waitForAcks: Boolean = false): Int = withContext(Dispatchers.IO) {
    val prefs = CollectorPrefs(context)
    val outbox = OutboxDb.getInstance(context)
    if (!prefs.isConfigured) return@withContext 0
    val base = prefs.apiBaseUrl?.trimEnd('/') ?: return@withContext 0
    val credential = prefs.credential ?: return@withContext 0

    var acknowledged = 0
    val skippedIds = mutableSetOf<String>()
    var loops = 0
    val maxLoops = if (waitForAcks) 30 else 10

    while (loops++ < maxLoops) {
      val pending = outbox.pending(limit = 50).filter { it.clientEventId !in skippedIds }
      if (pending.isEmpty()) break
      val batchId = UUID.randomUUID().toString()
      val body = JSONObject().apply {
        put("batchId", batchId)
        put("events", JSONArray().apply { pending.forEach { put(JSONObject(it.payloadJson)) } })
      }
      val req = Request.Builder()
        .url("$base/v1/collector/events")
        .header("Authorization", "Collector $credential")
        .header("x-paytsek-api-version", "v1")
        .post(body.toString().toRequestBody("application/json".toMediaType()))
        .build()
      try {
        client.newCall(req).execute().use { res ->
          when {
            res.code == 401 -> {
              prefs.lastUploadError = "COLLECTOR_CREDENTIAL_REVOKED"
              return@withContext acknowledged
            }
            res.code == 429 || res.code >= 500 -> {
              prefs.lastUploadError = "HTTP_${res.code}"
              outbox.bumpAttempts(pending.map { it.clientEventId })
              return@withContext acknowledged
            }
            !res.isSuccessful -> {
              prefs.lastUploadError = "HTTP_${res.code}"
              outbox.bumpAttempts(pending.map { it.clientEventId })
              return@withContext acknowledged
            }
          }
          val acks = JSONObject(res.body?.string() ?: "{}").optJSONArray("acks") ?: JSONArray()
          var progressed = false
          for (i in 0 until acks.length()) {
            val a = acks.getJSONObject(i)
            val outcome = a.optString("outcome")
            val id = a.optString("clientEventId")
            when (outcome) {
              "ACCEPTED", "DUPLICATE" -> { outbox.markAcknowledged(id, outcome); progressed = true; acknowledged++ }
              "REJECTED" -> {
                val reason = a.optString("reason")
                if (reason == "DEVICE_PAUSED") {
                  outbox.markRejectedPending(id, "REJECTED:DEVICE_PAUSED")
                  skippedIds += id
                } else {
                  outbox.markAcknowledged(id, "REJECTED:$reason")
                  progressed = true
                  acknowledged++
                }
              }
            }
          }
          prefs.lastUploadAt = Iso.now()
          prefs.lastUploadError = null
          if (!progressed) {
            outbox.bumpAttempts(pending.filter { it.clientEventId !in skippedIds }.map { it.clientEventId })
            break
          }
        }
      } catch (e: Exception) {
        prefs.lastUploadError = e.javaClass.simpleName
        outbox.bumpAttempts(pending.map { it.clientEventId })
        return@withContext acknowledged
      }
    }
    acknowledged
  }
}

/**
 * Uploads pending outbox items in bounded batches with per-item acknowledgement.
 * WorkManager provides persistence across process death/reboot, network
 * constraints and exponential backoff. Expedited execution is best-effort and
 * quota-limited by the OS; it is never treated as a guarantee.
 */
class UploadWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val prefs = CollectorPrefs(applicationContext)
    if (!prefs.isConfigured) return@withContext Result.success()
    UploadRunner.uploadPending(applicationContext, waitForAcks = false)
    Result.success()
  }

  companion object {
    private const val UNIQUE = "paytsek-upload"

    fun enqueue(context: Context, expedited: Boolean) {
      val builder = OneTimeWorkRequestBuilder<UploadWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
      if (expedited) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
      // A fresh payment should not wait behind a delayed retry, but replacing an
      // in-flight worker mid-request can lose acknowledgements. APPEND_OR_REPLACE
      // lets a running upload finish and chains the new request after it.
      WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE, ExistingWorkPolicy.APPEND_OR_REPLACE, builder.build())
    }
  }
}

/**
 * Content-free collector heartbeat. Android may keep the listener alive while
 * the React app is closed, so health has to be native too. Periodic work is
 * intentionally 15 minutes: Android's minimum reliable cadence, not a fake
 * real-time promise.
 */
class HealthWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val prefs = CollectorPrefs(applicationContext)
    if (!prefs.isConfigured) return@withContext Result.success()
    val base = prefs.apiBaseUrl?.trimEnd('/') ?: return@withContext Result.success()
    val credential = prefs.credential ?: return@withContext Result.success()
    val appVersion = try { applicationContext.packageManager.getPackageInfo(applicationContext.packageName, 0).versionName ?: "" } catch (_: Throwable) { "" }
    val apps = JSONArray().apply {
      ProviderApps.detectAll(applicationContext).filter { it.installed }.forEach {
        put(JSONObject().apply {
          put("provider", it.provider); put("packageName", it.packageName)
          put("versionName", it.versionName ?: JSONObject.NULL); put("versionCode", it.versionCode?.toInt() ?: JSONObject.NULL)
        })
      }
    }
    val body = JSONObject().apply {
      put("appVersion", appVersion)
      put("listenerConnected", prefs.listenerConnected)
      put("notificationAccessGranted", androidx.core.app.NotificationManagerCompat.getEnabledListenerPackages(applicationContext).contains(applicationContext.packageName))
      put("pendingUploadCount", OutboxDb.getInstance(applicationContext).pendingCount())
      put("lastObservedEventAt", prefs.lastObservedEventAt ?: JSONObject.NULL)
      put("unknownTemplateCount", prefs.unknownTemplateCount.toInt())
      put("diagnosticReason", prefs.lastUploadError ?: JSONObject.NULL)
      put("providerApps", apps)
    }
    val req = Request.Builder()
      .url("$base/v1/collector/health")
      .header("Authorization", "Collector $credential")
      .header("x-paytsek-api-version", "v1")
      .post(body.toString().toRequestBody("application/json".toMediaType()))
      .build()
    try {
      client.newCall(req).execute().use { response -> if (response.isSuccessful) Result.success() else if (response.code >= 500 || response.code == 429) Result.retry() else Result.failure() }
    } catch (_: Exception) { Result.retry() }
  }

  companion object {
    private const val ONCE = "paytsek-health-now"
    private const val PERIODIC = "paytsek-health-periodic"
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()
    private fun constraints() = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun enqueue(context: Context) {
      WorkManager.getInstance(context).enqueueUniqueWork(ONCE, ExistingWorkPolicy.REPLACE, OneTimeWorkRequestBuilder<HealthWorker>().setConstraints(constraints()).build())
    }

    fun schedule(context: Context) {
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, PeriodicWorkRequestBuilder<HealthWorker>(15, TimeUnit.MINUTES).setConstraints(constraints()).build())
    }
  }
}

/** After reboot, re-enqueue uploads for anything still pending in the outbox. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      try { if (OutboxDb.getInstance(context).pendingCount() > 0) UploadWorker.enqueue(context, expedited = false) } catch (_: Throwable) {}
    }
  }
}
