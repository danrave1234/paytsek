package ph.paytsek.collector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Parity cases mirroring tests/fixtures/notifications/gcash.json (SYNTHETIC).
 * Run with `./gradlew :payment-collector:testDebugUnitTest` inside an Android build.
 */
class NotificationParserTest {
  private fun input(text: String, pkg: String = "com.globe.gcash.android", summary: Boolean = false) =
    NotificationParser.Input(pkg, "GCash", text, null, emptyList(), summary)

  @Test fun acceptsIncomingWithReference() {
    val r = NotificationParser.parse(input("You have received PHP 1,250.00 of GCash from JU•N D. (+63 9•• ••• 1234) on Sep 08, 2026 1:05 AM. Ref. No. 1234567890123."))
    assertTrue(r is NotificationParser.Result.Accepted)
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(125000L, e.amountCentavos)
    assertEquals("1234567890123", e.referenceValue)
    assertEquals("GCASH_REF_NO", e.referenceNamespace)
    assertEquals("JU•N D.", e.payerMaskedName)
    assertEquals("+63 9•• ••• 1234", e.payerMaskedPhone)
    assertEquals("2026-09-07T17:05:00Z", e.providerDescribedAt)
  }

  @Test fun acceptsIncomingWithoutReferenceAndIgnoresBalance() {
    val r = NotificationParser.parse(input("You have received ₱500.00 from MA•IA S. (0917•••5678). Your new balance is ₱12,340.50."))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(50000L, e.amountCentavos)
    assertNull(e.referenceValue)
    assertEquals("UNKNOWN", e.referenceNamespace)
  }

  @Test fun rejectsOutgoing() = assertRejected("You have sent PHP 1,250.00 to JU•N D. Ref. No. 9876543210987.", "OUTGOING_PAYMENT")
  @Test fun rejectsOtp() = assertRejected("Your GCash OTP is 123456. Do not share this code with anyone.", "OTP_OR_SECURITY")
  @Test fun rejectsPromo() = assertRejected("Get ₱50 cashback when you pay with GCash this weekend! Tap to learn more.", "PROMOTION")
  @Test fun rejectsPending() = assertRejected("Your transfer of PHP 1,250.00 is pending. We will notify you once completed.", "FAILED_OR_PENDING")
  @Test fun rejectsUnknownTemplate() = assertRejected("Your GCash account statement for August is ready.", "UNKNOWN_TEMPLATE")

  @Test fun rejectsGroupSummary() {
    val r = NotificationParser.parse(input("3 new messages", summary = true))
    assertEquals("GROUP_SUMMARY", (r as NotificationParser.Result.Rejected).reason)
  }

  @Test fun rejectsLookalikePackage() {
    val r = NotificationParser.parse(input("You have received PHP 1,250.00 from JU•N D.", pkg = "com.example.fakegcash"))
    assertEquals("UNKNOWN_PACKAGE", (r as NotificationParser.Result.Rejected).reason)
  }

  @Test fun acceptsSuppliedGoTymeTemplateAndIgnoresBalance() {
    val r = NotificationParser.parse(NotificationParser.Input("com.gotyme.gotymebank", "Transfer received", "You received P1,250.00 from A. Santos. Your available balance is P9,000.00.", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals("GOTYME", e.provider); assertEquals(125000L, e.amountCentavos); assertEquals("A. Santos", e.payerMaskedName)
  }

  @Test fun acceptsSuppliedMayaTemplate() {
    val r = NotificationParser.parse(NotificationParser.Input("com.paymaya", "Money received ↙️", "You received 500.00 in your wallet via InstaPay", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals("MAYA", e.provider); assertEquals(50000L, e.amountCentavos); assertEquals("INSTAPAY", e.paymentRail)
  }

  @Test fun acceptsSuppliedMariBankTemplate() {
    val r = NotificationParser.parse(NotificationParser.Input("ph.seabank.seabank", "Successful Incoming Transfer", "You've received PHP 780.50 from bank with account ending 1234", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals("MARIBANK", e.provider); assertEquals(78050L, e.amountCentavos); assertNull(e.payerMaskedName)
  }

  @Test fun centavosAreExact() {
    assertEquals(125050L, NotificationParser.toCentavos("1,250.5"))
    assertEquals(1L, NotificationParser.toCentavos("0.01"))
    assertNull(NotificationParser.toCentavos("12.345"))
  }

  private fun assertRejected(text: String, reason: String) {
    val r = NotificationParser.parse(input(text))
    assertTrue("expected rejection", r is NotificationParser.Result.Rejected)
    assertEquals(reason, (r as NotificationParser.Result.Rejected).reason)
  }
}
