package ph.paytsek.collector

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/**
 * Opt-in capture of notification formats PayTsek does not recognise, so a
 * wallet can be supported without guessing at its template.
 *
 * Safety rules, in order of importance:
 *
 *  1. ONLY notifications rejected as UNKNOWN_TEMPLATE are eligible. Anything
 *     classified as OTP/security, outgoing, promotional or failed is discarded
 *     exactly as before and never reaches this file. See [isCaptureEligible].
 *  2. Text is redacted BEFORE it is written: every digit becomes '#' and every
 *     letter inside a word becomes 'a'/'A'. What survives is the shape of the
 *     template — labels, punctuation and field order — never a value.
 *  3. Rows stay on the phone. Nothing here is uploaded by the collector; the
 *     owner exports them deliberately.
 *  4. Off by default, capped, and clearable.
 */
object TemplateSamples {
  /** Hard cap so an unrecognised chatty app cannot fill the disk. */
  const val MAX_ROWS = 50

  /**
   * The single reject reason that may be captured. OTP/security text must
   * never be written to disk, so the allowlist is deliberately one entry long.
   */
  fun isCaptureEligible(reason: String): Boolean = reason == "UNKNOWN_TEMPLATE"

  /**
   * Replace values, keep structure. "Received PHP 1,250.00 from JU•N D."
   * becomes "Aaaaaaaa AAA #,###.## aaaa AA•A A." — enough to write a parser
   * against, useless to anyone who steals the phone.
   */
  fun redact(text: String?): String? {
    if (text == null) return null
    val out = StringBuilder(text.length)
    var previousWasLetter = false
    for (ch in text) {
      when {
        ch.isDigit() -> { out.append('#'); previousWasLetter = false }
        ch.isLetter() -> {
          // Keep capitalisation so label casing stays readable.
          out.append(if (previousWasLetter) (if (ch.isUpperCase()) 'A' else 'a') else (if (ch.isUpperCase()) 'A' else 'a'))
          previousWasLetter = true
        }
        else -> { out.append(ch); previousWasLetter = false }
      }
    }
    return out.toString()
  }

  data class Sample(
    val id: Long,
    val packageName: String,
    val provider: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val lines: List<String>,
    val appVersionName: String?,
    val capturedAt: String,
  )

  private class Db(context: Context) : SQLiteOpenHelper(context, "paytsek_template_samples.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
      db.execSQL(
        """
        create table samples (
          id integer primary key autoincrement,
          package_name text not null,
          provider text not null,
          title text,
          text text,
          big_text text,
          lines text not null,
          app_version_name text,
          captured_at text not null,
          shape_key text not null unique
        )
        """.trimIndent(),
      )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
      db.execSQL("drop table if exists samples")
      onCreate(db)
    }
  }

  private fun db(context: Context) = Db(context.applicationContext)

  /**
   * Store one redacted sample. Identical shapes collapse to a single row, so
   * ten copies of the same unknown alert do not become ten rows.
   */
  fun insert(
    context: Context,
    packageName: String,
    provider: String,
    title: String?,
    text: String?,
    bigText: String?,
    lines: List<String>,
    appVersionName: String?,
    capturedAt: String,
  ) {
    val rTitle = redact(title)
    val rText = redact(text)
    val rBig = redact(bigText)
    val rLines = lines.mapNotNull { redact(it) }
    val shapeKey = ProviderApps.sha256Hex(
      "$packageName|$rTitle|$rText|$rBig|${rLines.joinToString("|")}".toByteArray(),
    )

    db(context).writableDatabase.use { d ->
      val count = d.rawQuery("select count(*) from samples", null).use { c ->
        if (c.moveToFirst()) c.getLong(0) else 0L
      }
      if (count >= MAX_ROWS) return
      d.execSQL(
        "insert or ignore into samples (package_name, provider, title, text, big_text, lines, app_version_name, captured_at, shape_key) values (?,?,?,?,?,?,?,?,?)",
        arrayOf(packageName, provider, rTitle, rText, rBig, JSONArray(rLines).toString(), appVersionName, capturedAt, shapeKey),
      )
    }
  }

  fun list(context: Context): List<Sample> {
    val out = mutableListOf<Sample>()
    db(context).readableDatabase.use { d ->
      d.rawQuery(
        "select id, package_name, provider, title, text, big_text, lines, app_version_name, captured_at from samples order by id desc",
        null,
      ).use { c ->
        while (c.moveToNext()) {
          val rawLines = c.getString(6)
          val parsed = mutableListOf<String>()
          runCatching {
            val arr = JSONArray(rawLines)
            for (i in 0 until arr.length()) parsed.add(arr.getString(i))
          }
          out.add(
            Sample(
              id = c.getLong(0),
              packageName = c.getString(1),
              provider = c.getString(2),
              title = c.getString(3),
              text = c.getString(4),
              bigText = c.getString(5),
              lines = parsed,
              appVersionName = c.getString(7),
              capturedAt = c.getString(8),
            ),
          )
        }
      }
    }
    return out
  }

  fun clear(context: Context) {
    db(context).writableDatabase.use { it.execSQL("delete from samples") }
  }

  /** Shape matching the fixture files under tests/fixtures, ready to paste. */
  fun exportJson(context: Context): String {
    val arr = JSONArray()
    for (s in list(context)) {
      arr.put(
        JSONObject().apply {
          put("packageName", s.packageName)
          put("provider", s.provider)
          put("appVersionName", s.appVersionName ?: JSONObject.NULL)
          put("capturedAt", s.capturedAt)
          put("redacted", true)
          put(
            "input",
            JSONObject().apply {
              put("title", s.title ?: JSONObject.NULL)
              put("text", s.text ?: JSONObject.NULL)
              put("bigText", s.bigText ?: JSONObject.NULL)
              put("textLines", JSONArray(s.lines))
            },
          )
        },
      )
    }
    return JSONObject().apply {
      put("note", "Redacted notification shapes: digits are '#', letters are 'a'/'A'. No values are included.")
      put("samples", arr)
    }.toString(2)
  }
}
