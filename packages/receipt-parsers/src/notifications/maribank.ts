import { PROVIDER_PACKAGES } from '../registry';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export const MARIBANK_PARSER_ID = 'maribank.incoming.unsupported';
export const MARIBANK_PARSER_VERSION = '0';

/**
 * MariBank notification collection is NOT supported yet: no redacted real
 * incoming-payment notification sample is available, and fabricating a payload
 * format is prohibited. This adapter fails closed for every input.
 *
 * MariBank Philippines is the rebranded SeaBank Philippines (BSP digital
 * banking licence, 2025), which is why the package allowlist still carries the
 * SeaBank identifier.
 *
 * Registering it matters even while it rejects everything: without an adapter a
 * MariBank notification is rejected as UNKNOWN_PACKAGE here but as
 * UNKNOWN_TEMPLATE by the Kotlin parser, and only the latter is eligible for
 * opt-in shape capture — so the two sides must agree.
 *
 * To enable: capture redacted real samples (Settings → Unknown formats), add
 * fixtures under tests/fixtures/maribank/ with provenance
 * REDACTED_REAL_SAMPLE, implement the template here and in
 * NotificationParser.kt in lockstep, bump both versions, and update the flow
 * registry + provider support matrix.
 */
export const maribankAdapter: NotificationAdapter = {
  provider: 'MARIBANK',
  parserId: MARIBANK_PARSER_ID,
  parserVersion: MARIBANK_PARSER_VERSION,
  packages: PROVIDER_PACKAGES.MARIBANK,
  parse(input: NotificationText): NotificationParseResult {
    if (input.isGroupSummary) return { ok: false, reason: 'GROUP_SUMMARY' };
    if (!this.packages.includes(input.packageName)) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
    return { ok: false, reason: 'UNKNOWN_TEMPLATE' };
  },
};
