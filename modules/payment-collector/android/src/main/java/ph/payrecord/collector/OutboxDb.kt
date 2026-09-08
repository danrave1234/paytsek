package ph.payrecord.collector

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Native outbox (persisted BEFORE the listener callback returns). Sensitive
 * columns (masked payer identity, reference, normalized text hash) are encrypted
 * with an Android Keystore AES-256-GCM key; the raw notification body is never
 * stored. Bounded: oldest acknowledged rows are pruned; unacknowledged rows are
 * capped with a visible warning rather than silently dropped.
 */
class OutboxDb(context: Context) : SQLiteOpenHelper(context, "payrecord_outbox.db", null, 1) {

  data class Item(
    val clientEventId: String,
    val payloadJson: String,        // full IncomingPaymentEventInput JSON (encrypted at rest)
    val lifecycleDedupKey: String,
    val postedAt: String,
    val attempts: Int,
    val acknowledged: Boolean,
    val outcome: String?,
  )

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      create table outbox (
        client_event_id text primary key,
        lifecycle_dedup_key text not null unique,
        payload_enc text not null,
        posted_at text not null,
        created_at text not null,
        attempts integer not null default 0,
        acknowledged integer not null default 0,
        outcome text,
        acked_at text
      )
      """.trimIndent(),
    )
    db.execSQL("create index outbox_pending_idx on outbox(acknowledged, posted_at)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

  /** Insert; returns false when the lifecycle key was already seen (repost/update of same notification). */
  fun insertIfNew(item: Item): Boolean {
    val values = ContentValues().apply {
      put("client_event_id", item.clientEventId)
      put("lifecycle_dedup_key", item.lifecycleDedupKey)
      put("payload_enc", ColumnCrypto.encrypt(item.payloadJson))
      put("posted_at", item.postedAt)
      put("created_at", Iso.now())
      put("attempts", 0)
      put("acknowledged", 0)
    }
    val id = writableDatabase.insertWithOnConflict("outbox", null, values, SQLiteDatabase.CONFLICT_IGNORE)
    if (id != -1L) enforceBounds()
    return id != -1L
  }

  fun pending(limit: Int = 50): List<Item> {
    val out = mutableListOf<Item>()
    readableDatabase.rawQuery(
      "select client_event_id, lifecycle_dedup_key, payload_enc, posted_at, attempts, acknowledged, outcome from outbox where acknowledged = 0 order by posted_at limit ?",
      arrayOf(limit.toString()),
    ).use { c ->
      while (c.moveToNext()) {
        out += Item(
          clientEventId = c.getString(0),
          lifecycleDedupKey = c.getString(1),
          payloadJson = ColumnCrypto.decrypt(c.getString(2)),
          postedAt = c.getString(3),
          attempts = c.getInt(4),
          acknowledged = c.getInt(5) == 1,
          outcome = c.getString(6),
        )
      }
    }
    return out
  }

  fun pendingCount(): Int = readableDatabase.rawQuery("select count(*) from outbox where acknowledged = 0", null).use { it.moveToFirst(); it.getInt(0) }

  fun markAcknowledged(clientEventId: String, outcome: String) {
    writableDatabase.execSQL(
      "update outbox set acknowledged = 1, outcome = ?, acked_at = ? where client_event_id = ?",
      arrayOf(outcome, Iso.now(), clientEventId),
    )
  }

  fun bumpAttempts(ids: List<String>) {
    if (ids.isEmpty()) return
    val marks = ids.joinToString(",") { "?" }
    writableDatabase.execSQL("update outbox set attempts = attempts + 1 where client_event_id in ($marks)", ids.toTypedArray())
  }

  /** Retention: acknowledged rows older than 7 days are removed; unacknowledged rows are capped at 2000 (oldest evicted, counted). */
  fun enforceBounds(): Int {
    val db = writableDatabase
    db.execSQL("delete from outbox where acknowledged = 1 and acked_at < ?", arrayOf(Iso.daysAgo(7)))
    val pending = pendingCount()
    val overflow = pending - MAX_PENDING
    if (overflow > 0) {
      db.execSQL(
        "delete from outbox where client_event_id in (select client_event_id from outbox where acknowledged = 0 order by posted_at limit ?)",
        arrayOf(overflow.toString()),
      )
      return overflow
    }
    return 0
  }

  companion object {
    const val MAX_PENDING = 2000
    const val WARN_PENDING = 200
  }
}

/** AES-256-GCM column encryption with a non-exportable Android Keystore key. */
object ColumnCrypto {
  private const val ALIAS = "payrecord_outbox_aes"
  private const val TRANSFORM = "AES/GCM/NoPadding"

  private fun key(): SecretKey {
    val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (ks.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    gen.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return gen.generateKey()
  }

  fun encrypt(plain: String): String {
    val cipher = Cipher.getInstance(TRANSFORM)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val iv = cipher.iv
    val ct = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
    return Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP)
  }

  fun decrypt(enc: String): String {
    val (ivB64, ctB64) = enc.split(":", limit = 2)
    val cipher = Cipher.getInstance(TRANSFORM)
    cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)))
    return String(cipher.doFinal(Base64.decode(ctB64, Base64.NO_WRAP)), Charsets.UTF_8)
  }
}

object Iso {
  private val fmt = java.time.format.DateTimeFormatter.ISO_INSTANT
  fun now(): String = fmt.format(java.time.Instant.now())
  fun of(epochMs: Long): String = fmt.format(java.time.Instant.ofEpochMilli(epochMs))
  fun daysAgo(days: Long): String = fmt.format(java.time.Instant.now().minus(java.time.Duration.ofDays(days)))
}
