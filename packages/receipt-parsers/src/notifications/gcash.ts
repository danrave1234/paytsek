import { findMoneyCandidates } from '../money';
import { normalizeReference } from '../reference';
import { PROVIDER_PACKAGES } from '../registry';
import { parseManilaDateTime } from '../time';
import { classifyNegative } from './filters';
import { joinNotificationText, normalizeForHash } from './types';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const GCASH_PARSER_ID = 'gcash.incoming.v1';
export const GCASH_PARSER_VERSION = '1';

/**
 * Positive incoming-payment phrases. An adapter must require one of these; the
 * absence of a negative pattern is never enough.
 *
 * Template basis: the user-observed Express Send notification sample
 * (amount + masked sender name + masked phone). Treated as a *sample to
 * support*, not as a universal GCash contract. Additional forms are added only
 * with redacted real samples under tests/fixtures.
 */
const POSITIVE_INCOMING = [
  /\byou\s+(have\s+)?received\b/i,
  /\breceived\s+(₱|PHP|P)\s?[\d,]+(\.\d{1,2})?/i,
  /\bhas\s+sent\s+you\b/i,
  /\bsent\s+you\b/i,
  /\bmoney\s+received\b/i,
  /\bpayment\s+received\b/i,
];

/** "from JU•N D." / "from Juan D." / "from +63 9•• ••• 1234" — masked or partially masked. */
const FROM_RE =
  /\bfrom\s+([A-Z][A-Za-z•*.\-']*(?:\s+[A-Z•*][A-Za-z•*.\-']*){0,4})(?:\s*\(?\s*(\+?63|0)\s?9[\d•*\s-]{6,14}\)?)?/;

/** Standalone masked PH mobile number. */
const PHONE_RE = /(?:\+?63|0)\s?9[\d•*]{2}[\s-]?[\d•*]{3}[\s-]?[\d•*]{4}/;

/** "Ref. No. 1234567890123" / "Ref No: 1234 567 890 123" / "Reference No." */
const REF_RE = /\b(?:Ref(?:erence)?\.?\s*(?:No\.?|Number|#)?)\s*[:#]?\s*([\d][\d\s-]{6,24}\d)/i;

/** "on Sep 08, 2026 1:05 AM" / "on 09-08-2026 01:05 AM" */
const ON_DATE_RE =
  /\b(?:on|at)\s+((?:[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{4}-\d{2}-\d{2})(?:,?\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?)/;

export const gcashAdapter: NotificationAdapter = {
  provider: 'GCASH',
  parserId: GCASH_PARSER_ID,
  parserVersion: GCASH_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.GCASH,

  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };

    const text = joinNotificationText(input);
    if (text.length === 0) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };

    const negative = classifyNegative(text);
    if (negative) return { ok: false, reason: negative };

    if (!POSITIVE_INCOMING.some((p) => p.test(text))) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };

    // Amount: prefer the amount adjacent to "received"; otherwise require exactly one candidate.
    const receivedAmount = /\breceived\s+(?:₱|PHP|Php|P)\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/i.exec(text);
    let amountCentavos: number | null = null;
    if (receivedAmount?.[1]) {
      const c = findMoneyCandidates(`PHP ${receivedAmount[1]}`);
      amountCentavos = c[0]?.centavos ?? null;
    } else {
      // Exclude "balance" amounts from candidates.
      const withoutBalance = text.replace(/\b(?:new\s+)?balance\b[^\n.]*/gi, '');
      const candidates = findMoneyCandidates(withoutBalance);
      if (candidates.length === 0) return { ok: false, reason: 'NO_AMOUNT' };
      if (new Set(candidates.map((c) => c.centavos)).size > 1) return { ok: false, reason: 'AMBIGUOUS_AMOUNT' };
      amountCentavos = candidates[0]?.centavos ?? null;
    }
    if (amountCentavos === null) return { ok: false, reason: 'NO_AMOUNT' };

    const from = FROM_RE.exec(text);
    const payerMaskedName = from?.[1]?.trim() ?? null;
    const phoneMatch = PHONE_RE.exec(text);
    const payerMaskedPhone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : null;

    const ref = REF_RE.exec(text);
    const normalizedRef = ref?.[1] ? normalizeReference('GCASH_REF_NO', ref[1]) : null;

    const onDate = ON_DATE_RE.exec(text);
    const described = onDate?.[1] ? parseManilaDateTime(onDate[1]) : null;

    return {
      ok: true,
      event: {
        provider: 'GCASH',
        parserId: GCASH_PARSER_ID,
        parserVersion: GCASH_PARSER_VERSION,
        // The notification does not reliably say which rail was used; Express Send is
        // the only flow enabled for auto-match, and matching still requires the
        // registry to approve the (receipt rail, namespace) pair.
        paymentRail: 'EXPRESS_SEND',
        currency: 'PHP',
        amountCentavos,
        referenceNamespace: normalizedRef ? 'GCASH_REF_NO' : 'UNKNOWN',
        referenceValue: normalizedRef?.value ?? null,
        payerMaskedName,
        payerMaskedPhone,
        providerDescribedAt: described?.iso ?? null,
        normalizedText: normalizeForHash(text),
      },
    };
  },
};
