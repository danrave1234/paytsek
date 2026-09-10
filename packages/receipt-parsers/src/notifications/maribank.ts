import { findMoneyCandidates } from '../money';
import { PROVIDER_PACKAGES } from '../registry';
import { classifyNegative } from './filters';
import { joinNotificationText, normalizeForHash } from './types';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const MARIBANK_PARSER_ID = 'maribank.incoming.v1';
export const MARIBANK_PARSER_VERSION = '1';

/**
 * MariBank exposes only the sender bank and account suffix, not a payer
 * identity. This creates payment evidence, never a fabricated payer.
 */
const RECEIVED = /^You(?:'|’)ve received\s+(?:₱|PHP|P)\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s+from bank with account ending\s+\d{4}\.?$/i;
export const maribankAdapter: NotificationAdapter = {
  provider: 'MARIBANK',
  parserId: MARIBANK_PARSER_ID,
  parserVersion: MARIBANK_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.MARIBANK,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    const text = joinNotificationText(input);
    const body = (input.bigText ?? input.text ?? '').replace(/\s+/g, ' ').trim();
    if (!/^successful incoming transfer$/i.test(input.title?.trim() ?? '')) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const negative = classifyNegative(text);
    if (negative) return { ok: false, reason: negative };
    const match = RECEIVED.exec(body);
    if (!match?.[1]) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const amountCentavos = findMoneyCandidates(`PHP ${match[1]}`)[0]?.centavos;
    if (!amountCentavos) return { ok: false, reason: 'NO_AMOUNT' };
    return { ok: true, event: {
      provider: 'MARIBANK', parserId: MARIBANK_PARSER_ID, parserVersion: MARIBANK_PARSER_VERSION,
      paymentRail: 'UNKNOWN', currency: 'PHP', amountCentavos, referenceNamespace: 'UNKNOWN', referenceValue: null,
      payerMaskedName: null, payerMaskedPhone: null, providerDescribedAt: null, normalizedText: normalizeForHash(text),
    } };
  },
};
