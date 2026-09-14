import type { PaymentRail, Provider, ReferenceNamespace } from '@paytsek/contracts';

/** Raw notification text fields as exposed by Android's Notification extras. */
export interface NotificationText {
  packageName: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
  /** InboxStyle / MessagingStyle lines, if any. */
  textLines: string[];
  isGroupSummary: boolean;
}

export type RejectReason =
  | 'GROUP_SUMMARY'
  | 'UNKNOWN_PACKAGE'
  | 'OTP_OR_SECURITY'
  | 'OUTGOING_PAYMENT'
  | 'PROMOTION'
  | 'FAILED_OR_PENDING'
  | 'NO_AMOUNT'
  | 'AMBIGUOUS_AMOUNT'
  | 'UNKNOWN_TEMPLATE';

export interface ParsedIncomingPayment {
  provider: Provider;
  parserId: string;
  parserVersion: string;
  paymentRail: PaymentRail;
  currency: 'PHP';
  amountCentavos: number;
  referenceNamespace: ReferenceNamespace;
  referenceValue: string | null;
  payerMaskedName: string | null;
  payerMaskedPhone: string | null;
  /** ISO string if the notification described a time; parsed in Asia/Manila. */
  providerDescribedAt: string | null;
  /** The normalized text used for hashing/dedup (never stored in plain logs). */
  normalizedText: string;
}

export type NotificationParseResult =
  | { ok: true; event: ParsedIncomingPayment }
  | { ok: false; reason: RejectReason };

export interface NotificationAdapter {
  provider: Provider;
  parserId: string;
  parserVersion: string;
  packages: readonly string[];
  parse(input: NotificationText): NotificationParseResult;
}

export function joinNotificationText(input: NotificationText): string {
  const parts = [input.title, input.bigText ?? input.text, ...input.textLines].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0,
  );
  return parts.join('\n');
}

/** Whitespace/case-insensitive normalization for hashing and dedup. */
export function normalizeForHash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Payer names must never leave the parser unmasked. Provider templates usually
 * mask them already (MI*A P., MA•IA S.); when a template surfaces a fully
 * unmasked name, mask it locally: keep the first character of each word and
 * replace the rest with • (e.g. "Juan Dela Cruz" -> "J••• D••• C•••").
 * MUST stay in parity with NotificationParser.maskLocally on the Kotlin side.
 */
export function maskName(name: string): string {
  if (/[•*]/.test(name)) return name;
  return name
    .split(/\s+/)
    .map((w) => (w.length <= 1 ? w : w[0] + '•'.repeat(w.length - 1)))
    .join(' ');
}
