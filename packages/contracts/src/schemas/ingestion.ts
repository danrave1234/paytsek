import { z } from 'zod';
import { PaymentRail, Provider, ReferenceNamespace } from '../enums';
import { uuid } from './pairing';

/**
 * A canonical incoming-payment event as normalized on the collector device.
 * Only positive incoming-payment templates are ever uploaded. OTPs, outgoing
 * transfers, promotions and unknown content are dropped on-device and never
 * appear here.
 */
export const IncomingPaymentEventInput = z.object({
  /** Stable client-generated ID (UUID). Retrying cannot create a second event. */
  clientEventId: uuid,
  provider: Provider,
  /** Originating package as reported by the OS callback, e.g. com.globe.gcash.android */
  sourcePackage: z.string().max(200),
  sourceAppVersionName: z.string().max(60).nullable(),
  sourceAppVersionCode: z.number().int().nullable(),
  /** Parser identity so server/native parity can be audited. */
  parserId: z.string().max(80),
  parserVersion: z.string().max(20),
  paymentRail: PaymentRail,
  currency: z.literal('PHP'),
  /** Amount received by the seller in integer centavos (principal, not fees). */
  amountCentavos: z.number().int().positive(),
  referenceNamespace: ReferenceNamespace,
  referenceValue: z.string().max(80).nullable(),
  /** Masked sender identity exactly as shown by the provider, e.g. "JU•N D." or "+63 9•• ••• 1234". */
  payerMaskedName: z.string().max(120).nullable(),
  payerMaskedPhone: z.string().max(40).nullable(),
  /** Provider-described transaction time if it appears in the notification. */
  providerDescribedAt: z.string().datetime().nullable(),
  /** android.app.Notification#when */
  notificationWhenAt: z.string().datetime().nullable(),
  /** StatusBarNotification#getPostTime */
  postedAt: z.string().datetime(),
  /** Device wall clock when captured. */
  capturedAt: z.string().datetime(),
  /** SystemClock.elapsedRealtime at capture, with boot/session id to detect clock drift. */
  monotonicCaptureMs: z.number().int().nonnegative(),
  bootSessionId: z.string().max(64),
  /**
   * Dedup key derived on-device from (package, notification key/tag/id, normalized text hash).
   * Posting the same notification again or updating its text must map to the same key.
   */
  lifecycleDedupKey: z.string().max(128),
  /** SHA-256 of the normalized text fields — consistency, not authenticity. */
  normalizedTextSha256: z.string().length(64),
  /** Whether the notification was part of a group summary (summaries are not uploaded). */
  wasGroupChild: z.boolean().default(false),
});
export type IncomingPaymentEventInput = z.infer<typeof IncomingPaymentEventInput>;

export const IngestBatchRequest = z.object({
  /** Batch idempotency key (UUID); repeated batch replays the same acks. */
  batchId: uuid,
  events: z.array(IncomingPaymentEventInput).min(1).max(100),
});
export type IngestBatchRequest = z.infer<typeof IngestBatchRequest>;

export const IngestItemAck = z.object({
  clientEventId: uuid,
  outcome: z.enum(['ACCEPTED', 'DUPLICATE', 'REJECTED']),
  /** Server event ID when ACCEPTED or DUPLICATE. */
  eventId: uuid.nullable(),
  /** Stable reason for REJECTED; never echoes payload text. */
  reason: z
    .enum([
      'SOURCE_NOT_BOUND',
      'PROVIDER_NOT_ENABLED',
      'DEVICE_REVOKED',
      'DEVICE_PAUSED',
      'SCHEMA_INVALID',
      'AMBIGUOUS_LIFECYCLE_KEY',
    ])
    .nullable(),
});
export type IngestItemAck = z.infer<typeof IngestItemAck>;

export const IngestBatchResponse = z.object({
  batchId: uuid,
  acks: z.array(IngestItemAck),
  serverReceivedAt: z.string().datetime(),
});
export type IngestBatchResponse = z.infer<typeof IngestBatchResponse>;
