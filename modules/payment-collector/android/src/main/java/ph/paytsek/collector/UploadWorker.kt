package ph.paytsek.collector

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
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
class UploadWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
    val prefs = CollectorPrefs(applicationContext)
    val outbox = OutboxDb(applicationContext)
    if (!prefs.isConfigured) return@withContext Result.success()
    val base = prefs.apiBaseUrl!!.trimEnd('/')
    val credential = prefs.credential!!

    var loops = 0
    while (loops++ < 10) {
      val pending = outbox.pending(limit = 50)
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
              // Credential revoked/unknown: stop uploading, keep events, surface truthfully.
              prefs.lastUploadError = "COLLECTOR_CREDENTIAL_REVOKED"
              return@withContext Result.failure()
            }
            res.code == 429 || res.code >= 500 -> {
              prefs.lastUploadError = "HTTP_${res.code}"
              outbox.bumpAttempts(pending.map { it.clientEventId })
              return@withContext Result.retry()
            }
            !res.isSuccessful -> {
              prefs.lastUploadError = "HTTP_${res.code}"
              outbox.bumpAttempts(pending.map { it.clientEventId })
              return@withContext Result.retry()
            }
          }
          val acks = JSONObject(res.body?.string() ?: "{}").optJSONArray("acks") ?: JSONArray()
          for (i in 0 until acks.length()) {
            val a = acks.getJSONObject(i)
            val outcome = a.optString("outcome")
            val id = a.optString("clientEventId")
            when (outcome) {
              "ACCEPTED", "DUPLICATE" -> outbox.markAcknowledged(id, outcome)
              "REJECTED" -> {
                val reason = a.optString("reason")
                // Permanent rejections are acknowledged (kept for diagnostics); transient device states retry.
                if (reason == "DEVICE_PAUSED") { outbox.bumpAttempts(listOf(id)) } else outbox.markAcknowledged(id, "REJECTED:$reason")
              }
            }
          }
          prefs.lastUploadAt = Iso.now()
          prefs.lastUploadError = null
        }
      } catch (e: Exception) {
        prefs.lastUploadError = e.javaClass.simpleName
        outbox.bumpAttempts(pending.map { it.clientEventId })
        return@withContext Result.retry()
      }
    }
    Result.success()
  }

  companion object {
    private const val UNIQUE = "paytsek-upload"
    private val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(30, TimeUnit.SECONDS).build()

    fun enqueue(context: Context, expedited: Boolean) {
      val builder = OneTimeWorkRequestBuilder<UploadWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
      if (expedited) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
      WorkManager.getInstance(context).enqueueUniqueWork(UNIQUE, ExistingWorkPolicy.APPEND_OR_REPLACE, builder.build())
    }
  }
}

/** After reboot, re-enqueue uploads for anything still pending in the outbox. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
      try { if (OutboxDb(context).pendingCount() > 0) UploadWorker.enqueue(context, expedited = false) } catch (_: Throwable) {}
    }
  }
}
