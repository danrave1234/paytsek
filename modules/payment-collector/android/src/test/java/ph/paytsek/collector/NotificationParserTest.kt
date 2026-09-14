package ph.paytsek.collector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Parity cases mirroring the redacted current-push and legacy fixtures in
 * tests/fixtures/notifications/gcash.json.
 * Run with `./gradlew :payment-collector:testDebugUnitTest` inside an Android build.
 */
class NotificationParserTest {
  private fun input(text: String, pkg: String = "com.globe.gcash.android", summary: Boolean = false) =
    NotificationParser.Input(pkg, "GCash", text, null, emptyList(), summary)

  @Test fun acceptsCurrentAndroidPushWithoutReference() {
    val r = NotificationParser.parse(NotificationParser.Input("com.globe.gcash.android", "You have received money in GCash!", "You have received PHP 1,096.10 of GCash from MI*A P. 0915••••847.", null, emptyList(), false))
    assertTrue(r is NotificationParser.Result.Accepted)
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(109610L, e.amountCentavos)
    assertNull(e.referenceValue)
    assertEquals("UNKNOWN", e.referenceNamespace)
    assertEquals("MI*A P.", e.payerMaskedName)
    assertEquals("0915••••847", e.payerMaskedPhone)
    assertNull(e.providerDescribedAt)
  }

  @Test fun acceptsLegacyOptionalReferenceAndIgnoresBalance() {
    val r = NotificationParser.parse(input("You have received PHP 500.00 of GCash from MA•IA S. (0917•••5678). Your new balance is PHP 12,340.50. Ref. No. 1234567890123."))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(50000L, e.amountCentavos)
    assertEquals("1234567890123", e.referenceValue)
    assertEquals("GCASH_REF_NO", e.referenceNamespace)
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
    // The template surfaces an unmasked payer name; the parser masks it locally.
    assertEquals("GOTYME", e.provider); assertEquals(125000L, e.amountCentavos); assertEquals("A• S•••••", e.payerMaskedName)
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

  @Test fun acceptsCurrentPushWithPesoSign() {
    val r = NotificationParser.parse(NotificationParser.Input("com.globe.gcash.android", "You have received money in GCash!", "You have received ₱2,350.75 of GCash from JO*L R. 0917••••234.", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(235075L, e.amountCentavos)
    assertEquals("JO*L R.", e.payerMaskedName)
    assertEquals("0917••••234", e.payerMaskedPhone)
  }

  @Test fun masksUnmaskedGcashPayerNameLocally() {
    val r = NotificationParser.parse(input("You have received PHP 750.00 of GCash from Juan Dela Cruz via QR."))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(75000L, e.amountCentavos)
    assertEquals("J••• D••• C•••", e.payerMaskedName)
    assertNull(e.payerMaskedPhone)
  }

  @Test fun acceptsInstaPayWithRefAndDescribedTime() {
    val r = NotificationParser.parse(input("You have received PHP 5,000.00 via InstaPay from BDO on Sep 8, 2025 1:45 PM. Ref. No. 7031245896012."))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(500000L, e.amountCentavos)
    assertEquals("INSTAPAY", e.paymentRail)
    assertEquals("GCASH_REF_NO", e.referenceNamespace)
    assertEquals("7031245896012", e.referenceValue)
    assertEquals("2025-09-08T05:45:00Z", e.providerDescribedAt)
  }

  @Test fun rejectsAmbiguousAmount() {
    val r = NotificationParser.parse(input("You have received money in GCash. Amounts PHP 500.00 and PHP 300.00 arrived today."))
    assertEquals("AMBIGUOUS_AMOUNT", (r as NotificationParser.Result.Rejected).reason)
  }

  @Test fun acceptsMayaWithPesoSign() {
    val r = NotificationParser.parse(NotificationParser.Input("com.paymaya", "Money received ↙️", "You received ₱1,899.00 in your wallet via InstaPay", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals("MAYA", e.provider); assertEquals(189900L, e.amountCentavos)
  }

  @Test fun rejectsMayaOtp() {
    val r = NotificationParser.parse(NotificationParser.Input("com.paymaya", "Maya", "Use 123456 as your one-time password. Never share your code.", null, emptyList(), false))
    assertEquals("OTP_OR_SECURITY", (r as NotificationParser.Result.Rejected).reason)
  }

  @Test fun rejectsMayaNonIncomingBody() {
    val r = NotificationParser.parse(NotificationParser.Input("com.paymaya", "Money received ↙️", "You received a payment via QR", null, emptyList(), false))
    assertEquals("UNKNOWN_TEMPLATE", (r as NotificationParser.Result.Rejected).reason)
  }

  @Test fun acceptsGoTymeThousandsAndMasksName() {
    val r = NotificationParser.parse(NotificationParser.Input("com.gotyme.gotymebank", "Transfer received", "You received P25,000.00 from Maria Clara. Your available balance is P31,250.55.", null, emptyList(), false))
    val e = (r as NotificationParser.Result.Accepted).event
    assertEquals(2500000L, e.amountCentavos)
    assertEquals("M•••• C••••", e.payerMaskedName)
  }

  @Test fun acceptsMariBankCurlyApostrophe() {
    val r = NotificationParser.parse(NotificationParser.Input("ph.seabank.seabank", "Successful Incoming Transfer", "You’ve received PHP 1,299.99 from bank with account ending 5678", null, emptyList(), false))
    assertEquals(129999L, (r as NotificationParser.Result.Accepted).event.amountCentavos)
  }

  @Test fun rejectsMariBankOutgoing() {
    val r = NotificationParser.parse(NotificationParser.Input("ph.seabank.seabank", "Transfer Successful", "You've successfully sent PHP 500.00 to account ending 9012", null, emptyList(), false))
    assertEquals("OUTGOING_PAYMENT", (r as NotificationParser.Result.Rejected).reason)
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
