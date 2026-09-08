import { PROVIDER_PACKAGES } from '../registry';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const MAYA_PARSER_ID = 'maya.incoming.unsupported';
export const MAYA_PARSER_VERSION = '0';

/**
 * Maya notification collection is NOT supported yet: no redacted real
 * incoming-payment notification sample is available, and fabricating a payload
 * format is prohibited. This adapter fails closed for every input so the
 * collector increments the content-free "unknown template" metric and never
 * uploads Maya notification text.
 *
 * Registering it matters even while it rejects everything: without an adapter
 * a Maya notification is rejected as UNKNOWN_PACKAGE here but as
 * UNKNOWN_TEMPLATE by the Kotlin parser, and only the latter is eligible for
 * opt-in shape capture — so the two sides must agree.
 *
 * Recording Maya confirmations (via OCR) and manual confirmation remain
 * available. To enable: add fixtures under tests/fixtures/maya/ with
 * provenance REDACTED_REAL_SAMPLE, implement the template here and in
 * NotificationParser.kt in lockstep, bump both versions, and update the flow
 * registry + provider support matrix.
 */
export const mayaAdapter: NotificationAdapter = {
  provider: 'MAYA',
  parserId: MAYA_PARSER_ID,
  parserVersion: MAYA_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.MAYA,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
  },
};
