import { PROVIDER_PACKAGES } from '../registry';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const GOTYME_PARSER_ID = 'gotyme.incoming.unsupported';
export const GOTYME_PARSER_VERSION = '0';

/**
 * GoTyme notification collection is NOT supported yet: no redacted real
 * incoming-payment notification sample is available, and fabricating a payload
 * format is prohibited by the brief. This adapter fails closed for every input
 * so that the collector increments the content-free "unknown template" metric
 * and never uploads GoTyme notification text.
 *
 * Recording GoTyme receipts (via OCR) and manual confirmation remain available.
 * To enable: add fixtures under tests/fixtures/gotyme/ with provenance
 * REDACTED_REAL_SAMPLE, implement the template here, bump the version, and
 * update the flow registry + provider support matrix.
 */
export const gotymeAdapter: NotificationAdapter = {
  provider: 'GOTYME',
  parserId: GOTYME_PARSER_ID,
  parserVersion: GOTYME_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.GOTYME,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
  },
};
