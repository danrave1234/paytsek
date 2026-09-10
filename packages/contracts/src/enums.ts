import { z } from 'zod';

/**
 * Evidence state of a payment record. Used consistently in screens, exports,
 * API responses and analytics. PROVIDER_VERIFIED intentionally does not exist:
 * no authenticated provider integration is available in the MVP.
 */
export const EvidenceState = z.enum([
  'UNVERIFIED',
  'REVIEW_REQUIRED',
  'MATCHED_AUTO',
  'MATCHED_BY_USER',
  'CONFIRMED_MANUALLY',
  'VOIDED',
]);
export type EvidenceState = z.infer<typeof EvidenceState>;

/** Default user-facing labels. Never "GCash verified" or a bare "VERIFIED". */
export const EVIDENCE_STATE_LABELS: Record<EvidenceState, string> = {
  UNVERIFIED: 'Unverified',
  REVIEW_REQUIRED: 'Review needed',
  MATCHED_AUTO: 'Notification matched',
  MATCHED_BY_USER: 'Notification matched',
  CONFIRMED_MANUALLY: 'Confirmed manually',
  VOIDED: 'Voided',
};

/** Required disclosure shown on any automatic-match detail view. */
export const AUTO_MATCH_DISCLOSURE =
  'Matched to an incoming notification; not confirmed directly with the payment provider.';

/** Flags are not mutually exclusive and are separate from the evidence state. */
export const RecordFlag = z.enum([
  'DUPLICATE_SUSPECTED',
  'RECIPIENT_MISMATCH',
  'SOURCE_STALE',
  'PARSE_UNSUPPORTED',
  'SIMILAR_IMAGE',
]);
export type RecordFlag = z.infer<typeof RecordFlag>;

/** Sync status is kept separate from evidence status. */
export const SyncStatus = z.enum(['LOCAL_DRAFT', 'UPLOADING', 'PARTIAL_UPLOAD', 'SYNCED', 'FAILED']);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const MembershipRole = z.enum(['OWNER', 'CASHIER']);
export type MembershipRole = z.infer<typeof MembershipRole>;

/** Device capabilities are separate from human roles. */
export const DeviceCapability = z.enum(['SCANNER', 'COLLECTOR', 'BOTH']);
export type DeviceCapability = z.infer<typeof DeviceCapability>;

export const DevicePlatform = z.enum(['ANDROID', 'IOS']);
export type DevicePlatform = z.infer<typeof DevicePlatform>;

/** Launch providers. Recording is supported for all of them; automatic matching is per tested flow. */
export const Provider = z.enum(['GCASH', 'GOTYME', 'MAYA', 'MARIBANK']);
export type Provider = z.infer<typeof Provider>;

/** Brand spelling as the providers write it. Use everywhere users can see it. */
export const PROVIDER_LABELS: Record<Provider, string> = {
  GCASH: 'GCash',
  GOTYME: 'GoTyme',
  MAYA: 'Maya',
  MARIBANK: 'MariBank',
};

/** Stable display order for pickers and marketing lists. */
export const PROVIDERS: readonly { value: Provider; label: string }[] = Provider.options.map((value) => ({
  value,
  label: PROVIDER_LABELS[value],
}));

/** Payment rail as printed on a receipt or described by a notification. */
export const PaymentRail = z.enum([
  'EXPRESS_SEND',
  'QR_P2P',
  'QR_MERCHANT',
  'INSTAPAY',
  'PESONET',
  'BANK_TRANSFER',
  'UNKNOWN',
]);
export type PaymentRail = z.infer<typeof PaymentRail>;

/**
 * A reference namespace identifies *where* a reference value came from. Values
 * from different namespaces are never compared unless a flow is registered as
 * comparable in the capability registry.
 */
export const ReferenceNamespace = z.enum([
  'GCASH_REF_NO',
  'GCASH_EXPRESS_SEND_REF',
  'GOTYME_REF_NO',
  'MAYA_REF_NO',
  'MARIBANK_REF_NO',
  'INSTAPAY_TRACE_NO',
  'PESONET_TRACE_NO',
  'UNKNOWN',
]);
export type ReferenceNamespace = z.infer<typeof ReferenceNamespace>;

export const CaptureOrigin = z.enum(['CAMERA', 'IMAGE_IMPORT', 'SHARE_SHEET', 'FROM_EVENT']);
export type CaptureOrigin = z.infer<typeof CaptureOrigin>;

/** Receipt status as printed on the customer's proof. Never inferred. */
export const ReceiptStatus = z.enum(['SUCCESS', 'PENDING', 'FAILED', 'UNKNOWN']);
export type ReceiptStatus = z.infer<typeof ReceiptStatus>;

/** Precision of a timestamp extracted from a receipt. */
export const TimePrecision = z.enum(['SECOND', 'MINUTE', 'HOUR', 'DAY', 'UNKNOWN']);
export type TimePrecision = z.infer<typeof TimePrecision>;

/** Which time basis was used for a candidate search. */
export const TimeBasis = z.enum(['RECEIPT_TRANSACTION_TIME', 'CAPTURE_TIME', 'NONE']);
export type TimeBasis = z.infer<typeof TimeBasis>;

export const MatchKind = z.enum(['AUTO', 'USER_SELECTED', 'MANUAL_OWNER_CONFIRMATION']);
export type MatchKind = z.infer<typeof MatchKind>;

/** Reason codes attached to matches and review outcomes. */
export const MatchReasonCode = z.enum([
  'EXACT_REFERENCE_AND_AMOUNT',
  'DELAYED_EXACT_REFERENCE',
  'USER_SELECTED_CANDIDATE',
  'OWNER_CONFIRMED_IN_WALLET',
  'AMOUNT_ONLY_CANDIDATES',
  'MULTIPLE_CANDIDATES',
  'NO_COMPARABLE_NAMESPACE',
  'AMOUNT_MISMATCH',
  'SOURCE_MISMATCH',
  'CONTRADICTORY_DATA',
  'RECEIPT_EDITED_AFTER_MATCH',
  'UNLINKED_BY_OWNER',
  'EVENT_ALREADY_LINKED',
]);
export type MatchReasonCode = z.infer<typeof MatchReasonCode>;

export const PairingState = z.enum(['PENDING', 'ACCEPTED', 'APPROVED', 'EXPIRED', 'REJECTED', 'CONSUMED']);
export type PairingState = z.infer<typeof PairingState>;

export const DeviceStatus = z.enum(['ACTIVE', 'PAUSED', 'REVOKED']);
export type DeviceStatus = z.infer<typeof DeviceStatus>;

export const PlanCode = z.enum(['FREE', 'STARTER', 'BUSINESS']);
export type PlanCode = z.infer<typeof PlanCode>;

export const SubscriptionStatus = z.enum([
  'NONE',
  'ACTIVE',
  'GRACE_PERIOD',
  'BILLING_RETRY',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatus>;

export const ExportFormat = z.enum(['CSV', 'XLSX']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const JobStatus = z.enum(['PENDING', 'LEASED', 'DONE', 'FAILED', 'DEAD']);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobKind = z.enum([
  'RECONCILE_RECORD',
  'RECONCILE_EVENT',
  'GENERATE_EXPORT',
  'PURGE_RETENTION',
  'RECONCILE_ENTITLEMENT',
]);
export type JobKind = z.infer<typeof JobKind>;

export const AuditAction = z.enum([
  'RECORD_CREATED',
  'RECORD_CORRECTED',
  'RECORD_VOIDED',
  'MATCH_AUTO',
  'MATCH_BY_USER',
  'MATCH_CONFIRMED_MANUALLY',
  'MATCH_UNLINKED',
  'MATCH_REOPENED',
  'EVENT_INGESTED',
  'EVENT_SAVED_AS_RECORD',
  'DEVICE_PAIRED',
  'DEVICE_APPROVED',
  'DEVICE_PAUSED',
  'DEVICE_REVOKED',
  'SOURCE_CREATED',
  'SOURCE_UPDATED',
  'MEMBER_INVITED',
  'MEMBER_REMOVED',
  'QUOTA_CONSUMED',
  'QUOTA_ADJUSTED',
  'CREDIT_GRANTED',
  'CREDIT_REVOKED',
  'SUBSCRIPTION_CHANGED',
  'EXPORT_CREATED',
  'WORKSPACE_DELETED',
]);
export type AuditAction = z.infer<typeof AuditAction>;

export const CURRENCY_PHP = 'PHP' as const;
