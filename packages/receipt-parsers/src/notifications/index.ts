import { gcashAdapter } from './gcash';
import { gotymeAdapter } from './gotyme';
import type { NotificationAdapter, NotificationParseResult, NotificationText } from './types';

export * from './types';
export * from './filters';
export { gcashAdapter, GCASH_PARSER_ID, GCASH_PARSER_VERSION } from './gcash';
export { gotymeAdapter, GOTYME_PARSER_ID, GOTYME_PARSER_VERSION } from './gotyme';

export const NOTIFICATION_ADAPTERS: readonly NotificationAdapter[] = [gcashAdapter, gotymeAdapter];

export function adapterForPackage(packageName: string): NotificationAdapter | null {
  return NOTIFICATION_ADAPTERS.find((a) => a.packages.includes(packageName)) ?? null;
}

/**
 * Parse a notification using the adapter registered for its package. Unknown
 * packages are rejected before any text is inspected.
 */
export function parseNotification(input: NotificationText): NotificationParseResult {
  const adapter = adapterForPackage(input.packageName);
  if (!adapter) return { ok: false, reason: 'UNKNOWN_PACKAGE' };
  return adapter.parse(input);
}
