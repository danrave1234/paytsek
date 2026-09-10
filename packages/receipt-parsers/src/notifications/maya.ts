import { findMoneyCandidates } from '../money';
import { PROVIDER_PACKAGES } from '../registry';
import { classifyNegative } from './filters';
import { joinNotificationText, normalizeForHash } from './types';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const MAYA_PARSER_ID = 'maya.incoming.v1';
export const MAYA_PARSER_VERSION = '1';

/**
 * Maya's supplied title can contain a southwest-arrow emoji; the stable title
 * text is the contract, so cosmetic emoji variation cannot break collection.
 */
const RECEIVED = /^You received\s+(?:₱|PHP|P)?\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)\s+in your wallet via InstaPay\.?$/i;
export const mayaAdapter: NotificationAdapter = {
  provider: 'MAYA',
  parserId: MAYA_PARSER_ID,
  parserVersion: MAYA_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.MAYA,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    const text = joinNotificationText(input);
    const body = (input.bigText ?? input.text ?? '').replace(/\s+/g, ' ').trim();
    if (!/^money received\b/i.test(input.title?.trim() ?? '')) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const negative = classifyNegative(text);
    if (negative) return { ok: false, reason: negative };
    const match = RECEIVED.exec(body);
    if (!match?.[1]) return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
    const amountCentavos = findMoneyCandidates(`PHP ${match[1]}`)[0]?.centavos;
    if (!amountCentavos) return { ok: false, reason: 'NO_AMOUNT' };
    return { ok: true, event: {
      provider: 'MAYA', parserId: MAYA_PARSER_ID, parserVersion: MAYA_PARSER_VERSION,
      paymentRail: 'INSTAPAY', currency: 'PHP', amountCentavos, referenceNamespace: 'UNKNOWN', referenceValue: null,
      payerMaskedName: null, payerMaskedPhone: null, providerDescribedAt: null, normalizedText: normalizeForHash(text),
    } };
  },
};
