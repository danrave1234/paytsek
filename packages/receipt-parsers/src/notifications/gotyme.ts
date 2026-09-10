import { findMoneyCandidates } from '../money';
import { PROVIDER_PACKAGES } from '../registry';
import { classifyNegative } from './filters';
import { joinNotificationText, normalizeForHash } from './types';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const GOTYME_PARSER_ID = 'gotyme.incoming.v1';
export const GOTYME_PARSER_VERSION = '1';

/**
 * Strict, user-supplied GoTyme incoming-transfer template. The balance is
 * deliberately matched but never parsed as the payment amount.
 */
const MONEY = '((?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?)';
const RECEIVED = new RegExp(
  `^You received\\s+(?:₱|PHP|P)\\s?${MONEY}\\s+from\\s+(.+?)\\.\\s*Your available balance is\\s+(?:₱|PHP|P)\\s?${MONEY}\\.?$`,
  'i',
);

export const gotymeAdapter: NotificationAdapter = {
  provider: 'GOTYME',
  parserId: GOTYME_PARSER_ID,
  parserVersion: GOTYME_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.GOTYME,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    const text = joinNotificationText(input);
    const body = (input.bigText ?? input.text ?? '').replace(/\s+/g, ' ').trim();
    if (!/^transfer received$/i.test(input.title?.trim() ?? '')) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const negative = classifyNegative(text);
    if (negative) return { ok: false, reason: negative };
    const match = RECEIVED.exec(body);
    if (!match?.[1] || !match[2]) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const amountCentavos = findMoneyCandidates(`PHP ${match[1]}`)[0]?.centavos;
    if (!amountCentavos) return { ok: false, reason: 'NO_AMOUNT' };
    return { ok: true, event: {
      provider: 'GOTYME', parserId: GOTYME_PARSER_ID, parserVersion: GOTYME_PARSER_VERSION,
      paymentRail: 'UNKNOWN', currency: 'PHP', amountCentavos, referenceNamespace: 'UNKNOWN', referenceValue: null,
      payerMaskedName: match[2].trim(), payerMaskedPhone: null, providerDescribedAt: null, normalizedText: normalizeForHash(text),
    } };
  },
};
