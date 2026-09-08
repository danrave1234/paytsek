import { z } from 'zod';
import { MatchReasonCode, PaymentRail, Provider, ReferenceNamespace, TimeBasis } from '../enums';
import { uuid } from './pairing';

/**
 * Minimal candidate view returned to cashiers. Never includes the owner's full
 * inbox, raw notification text, or unmasked identity.
 */
export const CandidateEvent = z.object({
  eventId: uuid,
  provider: Provider,
  paymentRail: PaymentRail,
  currency: z.literal('PHP'),
  amountCentavos: z.number().int(),
  referenceNamespace: ReferenceNamespace,
  /** Present only if the notification contained a reference. */
  referenceValue: z.string().nullable(),
  payerMaskedName: z.string().nullable(),
  payerMaskedPhone: z.string().nullable(),
  /** Best available event time and which timestamp it is. */
  eventAt: z.string().datetime(),
  eventTimeSource: z.enum(['PROVIDER_DESCRIBED', 'NOTIFICATION_WHEN', 'POSTED']),
  /** Seconds between record time basis and eventAt (signed). */
  deltaSeconds: z.number().int().nullable(),
  /** Fields that agree with the record vs. fields missing on either side. */
  supportingFields: z.array(z.string()),
  missingFields: z.array(z.string()),
  /** Why this cannot be auto-matched. */
  blockers: z.array(MatchReasonCode),
  alreadyLinkedToOtherRecord: z.boolean(),
});
export type CandidateEvent = z.infer<typeof CandidateEvent>;

export const CandidatesResponse = z.object({
  recordId: uuid,
  timeBasis: TimeBasis,
  windowSeconds: z.number().int(),
  candidates: z.array(CandidateEvent),
  /** True if the collector for this source has not contacted the server recently. */
  collectorStale: z.boolean(),
  collectorLastSeenAt: z.string().datetime().nullable(),
});
export type CandidatesResponse = z.infer<typeof CandidatesResponse>;

/** Authorized user selects a candidate association (MATCHED_BY_USER). */
export const ConfirmCandidateRequest = z.object({
  eventId: uuid,
  note: z.string().max(300).nullable().optional(),
});
export type ConfirmCandidateRequest = z.infer<typeof ConfirmCandidateRequest>;

/** Owner reports checking the wallet directly (CONFIRMED_MANUALLY). No event required. */
export const ConfirmManuallyRequest = z.object({
  note: z.string().max(300).nullable().optional(),
});

export const UnlinkRequest = z.object({
  reason: z.string().min(3).max(300),
  /** Optional replacement association performed in the same transaction. */
  reassignToEventId: uuid.nullable().optional(),
});
export type UnlinkRequest = z.infer<typeof UnlinkRequest>;

export const EscalateRequest = z.object({
  message: z.string().max(500).nullable().optional(),
});

/** Owner-only inbox row (restricted retention: 7 days if never linked/saved). */
export const OwnerInboxEvent = CandidateEvent.omit({
  deltaSeconds: true,
  supportingFields: true,
  missingFields: true,
  blockers: true,
}).extend({
  sourceId: uuid,
  sourceLabel: z.string(),
  deviceId: uuid,
  linkedRecordId: uuid.nullable(),
  serverReceivedAt: z.string().datetime(),
  purgeAfter: z.string().datetime().nullable(),
});
export type OwnerInboxEvent = z.infer<typeof OwnerInboxEvent>;
