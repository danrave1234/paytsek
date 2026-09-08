package ph.payrecord.collector

import java.math.BigDecimal
import java.security.MessageDigest
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.util.Locale

/**
 * On-device parser. MUST stay in parity with packages/receipt-parsers
 * (notifications/filters.ts + notifications/gcash.ts); the fixtures under
 * tests/fixtures/notifications are the shared contract. Parser ids/versions are
 * uploaded with each event so the server can audit which rules produced it.
 *
 * Reject-first: OTP/security, failed/pending, outgoing, promotions are dropped
 * on-device and never persisted or uploaded. Unknown templates only increment a
 * content-free counter.
 */
object NotificationParser {
  const val GCASH_PARSER_ID = "gcash.incoming.v1"
  const val GCASH_PARSER_VERSION = "1"

  data class Input(val packageName: String, val title: String?, val text: String?, val bigText: String?, val textLines: List<String>, val isGroupSummary: Boolean)

  sealed class Result {
    data class Accepted(val event: Parsed) : Result()
    data class Rejected(val reason: String) : Result()
  }

  data class Parsed(
    val provider: String,
    val parserId: String,
    val parserVersion: String,
    val paymentRail: String,
    val amountCentavos: Long,
    val referenceNamespace: String,
    val referenceValue: String?,
    val payerMaskedName: String?,
    val payerMaskedPhone: String?,
    val providerDescribedAt: String?,
    val normalizedText: String,
    val normalizedTextSha256: String,
  )

  private val OTP = listOf(
    "\\bOTP\\b", "one[- ]time\\s+(pin|password|code)", "authentication\\s+code", "verification\\s+code", "\\bMPIN\\b",
    "do\\s+not\\s+share", "never\\s+share", "login\\s+attempt", "new\\s+device", "password", "suspicious",
  ).map { Regex(it, RegexOption.IGNORE_CASE) }
  private val OUTGOING = listOf(
    "\\byou\\s+(have\\s+)?sent\\b", "\\byou\\s+(have\\s+)?paid\\b", "\\bpayment\\s+(of\\s+)?(₱|PHP|P)?\\s?[\\d,.]+\\s+to\\b", "\\bsuccessfully\\s+sent\\b",
    "\\bhas\\s+been\\s+sent\\b", "\\bcash[- ]?out\\b", "\\bwithdraw", "\\bbills?\\s+payment\\b", "\\bpaid\\s+your\\b", "\\bbought\\b", "\\bload\\s+purchase\\b", "\\bsent\\s+(₱|PHP|P)\\s?[\\d,.]+",
  ).map { Regex(it, RegexOption.IGNORE_CASE) }
  private val PROMO = listOf(
    "\\bpromo\\b", "\\bvoucher\\b", "\\bcashback\\b", "\\bdiscount\\b", "\\braffle\\b", "\\bwin\\b", "\\bGForest\\b", "\\bGLife\\b", "\\bGInvest\\b", "\\bGCredit\\b",
    "\\bGLoan\\b", "\\bGGives\\b", "\\bGSave\\b", "\\bGInsure\\b", "\\bexclusive\\b", "\\blimited\\s+time\\b", "\\bapply\\s+now\\b", "\\btap\\s+to\\s+learn\\b", "\\breminder\\b", "\\bdue\\b",
  ).map { Regex(it, RegexOption.IGNORE_CASE) }
  private val FAILED = listOf(
    "\\bfailed\\b", "\\bunsuccessful\\b", "\\bdeclined\\b", "\\bpending\\b", "\\bprocessing\\b", "\\breversed\\b", "\\brefund", "\\bcancel", "\\bexpired\\b", "\\bnot\\s+(be\\s+)?completed\\b",
  ).map { Regex(it, RegexOption.IGNORE_CASE) }
  private val POSITIVE = listOf(
    "\\byou\\s+(have\\s+)?received\\b", "\\breceived\\s+(₱|PHP|P)\\s?[\\d,]+(\\.\\d{1,2})?", "\\bhas\\s+sent\\s+you\\b", "\\bsent\\s+you\\b", "\\bmoney\\s+received\\b", "\\bpayment\\s+received\\b",
  ).map { Regex(it, RegexOption.IGNORE_CASE) }

  private val RECEIVED_AMOUNT = Regex("\\breceived\\s+(?:₱|PHP|Php|P)\\s?((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
  private val ANY_AMOUNT = Regex("(?:₱|PHP|Php|php|P)?\\s?((?:\\d{1,3}(?:,\\d{3})+)|\\d+)(?:\\.(\\d{1,2}))?(?!\\d)")
  private val FROM = Regex("\\bfrom\\s+([A-Z][A-Za-z•*.\\-']*(?:\\s+[A-Z•*][A-Za-z•*.\\-']*){0,4})")
  private val PHONE = Regex("(?:\\+?63|0)\\s?9[\\d•*]{2}[\\s-]?[\\d•*]{3}[\\s-]?[\\d•*]{4}")
  private val REF = Regex("\\b(?:Ref(?:erence)?\\.?\\s*(?:No\\.?|Number|#)?)\\s*[:#]?\\s*([\\d][\\d\\s-]{6,24}\\d)", RegexOption.IGNORE_CASE)
  private val ON_DATE = Regex("\\b(?:on|at)\\s+((?:[A-Za-z]{3,9}\\.?\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{4}-\\d{2}-\\d{2})(?:,?\\s+(?:at\\s+)?\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM|am|pm)?)?)")

  fun parse(input: Input): Result {
    if (input.isGroupSummary) return Result.Rejected("GROUP_SUMMARY")
    val provider = ProviderApps.providerFor(input.packageName) ?: return Result.Rejected("UNKNOWN_PACKAGE")
    if (provider != "GCASH") return Result.Rejected("UNKNOWN_TEMPLATE") // GoTyme: no verified template yet (fail closed)

    val text = listOfNotNull(input.title, input.bigText ?: input.text).plus(input.textLines).filter { it.isNotBlank() }.joinToString("\n")
    if (text.isBlank()) return Result.Rejected("UNKNOWN_TEMPLATE")

    if (OTP.any { it.containsMatchIn(text) }) return Result.Rejected("OTP_OR_SECURITY")
    if (FAILED.any { it.containsMatchIn(text) }) return Result.Rejected("FAILED_OR_PENDING")
    if (OUTGOING.any { it.containsMatchIn(text) }) return Result.Rejected("OUTGOING_PAYMENT")
    if (PROMO.any { it.containsMatchIn(text) }) return Result.Rejected("PROMOTION")
    if (POSITIVE.none { it.containsMatchIn(text) }) return Result.Rejected("UNKNOWN_TEMPLATE")

    val amount: Long = RECEIVED_AMOUNT.find(text)?.groupValues?.get(1)?.let { toCentavos(it) } ?: run {
      val withoutBalance = text.replace(Regex("\\b(?:new\\s+)?balance\\b[^\\n.]*", RegexOption.IGNORE_CASE), "")
      val candidates = ANY_AMOUNT.findAll(withoutBalance).mapNotNull { m ->
        val raw = m.value
        val hasPrefix = Regex("^(₱|PHP|Php|php|P)").containsMatchIn(raw.trim())
        val hasDecimal = m.groups[2] != null
        val hasThousands = m.groupValues[1].contains(',')
        if (!hasPrefix && !hasDecimal && !hasThousands) null else toCentavos(m.groupValues[1] + (m.groups[2]?.value?.let { ".$it" } ?: ""))
      }.toList()
      if (candidates.isEmpty()) return Result.Rejected("NO_AMOUNT")
      if (candidates.toSet().size > 1) return Result.Rejected("AMBIGUOUS_AMOUNT")
      candidates.first()
    }
    if (amount <= 0) return Result.Rejected("NO_AMOUNT")

    val name = FROM.find(text)?.groupValues?.get(1)?.trim()
    val phone = PHONE.find(text)?.value?.replace(Regex("\\s+"), " ")?.trim()
    val ref = REF.find(text)?.groupValues?.get(1)?.replace(Regex("[\\s-]"), "")?.takeIf { Regex("^\\d{8,20}$").matches(it) }
    val described = ON_DATE.find(text)?.groupValues?.get(1)?.let { parseManila(it) }
    val normalized = text.replace(Regex("\\s+"), " ").trim()

    return Result.Accepted(
      Parsed(
        provider = "GCASH",
        parserId = GCASH_PARSER_ID,
        parserVersion = GCASH_PARSER_VERSION,
        paymentRail = "EXPRESS_SEND",
        amountCentavos = amount,
        referenceNamespace = if (ref != null) "GCASH_REF_NO" else "UNKNOWN",
        referenceValue = ref,
        payerMaskedName = name,
        payerMaskedPhone = phone,
        providerDescribedAt = described,
        normalizedText = normalized,
        normalizedTextSha256 = sha256(normalized),
      ),
    )
  }

  /** Exact decimal -> integer centavos (never floating point). */
  fun toCentavos(raw: String): Long? {
    val cleaned = raw.replace(",", "").trim()
    if (!Regex("^\\d+(\\.\\d{1,2})?$").matches(cleaned)) return null
    return try { BigDecimal(cleaned).movePointRight(2).setScale(0).longValueExact() } catch (e: ArithmeticException) { null }
  }

  private val MANILA: ZoneId = ZoneId.of("Asia/Manila")
  private val FORMATS: List<DateTimeFormatter> = listOf(
    "MMM d, yyyy h:mm a", "MMM d, yyyy h:mm:ss a", "MMMM d, yyyy h:mm a", "MMMM d, yyyy h:mm:ss a", "MMM d yyyy h:mm a",
    "MM/dd/yyyy h:mm a", "MM-dd-yyyy h:mm a", "MM/dd/yyyy hh:mm a", "MM-dd-yyyy hh:mm a", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd HH:mm",
    "d MMM yyyy, HH:mm", "d MMM yyyy HH:mm",
  ).map { DateTimeFormatterBuilder().parseCaseInsensitive().appendPattern(it).toFormatter(Locale.ENGLISH) }

  fun parseManila(raw: String): String? {
    val s = raw.trim().replace(Regex("\\s+"), " ")
    for (f in FORMATS) {
      try {
        val ldt = LocalDateTime.parse(s, f)
        return DateTimeFormatter.ISO_INSTANT.format(ldt.atZone(MANILA).toInstant())
      } catch (_: Exception) { /* try next */ }
    }
    return null
  }

  fun sha256(s: String): String = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
}
