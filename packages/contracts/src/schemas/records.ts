import { z } from 'zod';
import {
  CaptureOrigin,
  EvidenceState,
  MatchKind,
  MatchReasonCode,
  PaymentRail,
  Provider,
  ReceiptStatus,
  RecordFlag,
  ReferenceNamespace,
  SyncStatus,
  TimeBasis,
  TimePrecision,
} from '../enums';
import { uuid } from './pairing';

/**
 * Fields extracted from a receipt. Every value is nullable: missing values stay
 * null and are never invented. Payer and payee are kept strictly separate.
 */
export const ReceiptFields = z.object({
  receiptProvider: Provider.nullable(),
  paymentRail: PaymentRail.nullable(),
  currency: z.literal('PHP').nullable(),
  amountCentavos: z.number().int().positive().nullable(),
  /** Fee shown on the receipt, if any; never guessed. */
  feeCentavos: z.number().int().nonnegative().nullable(),
  /** Total charged to the payer including fee, if shown. */
  totalChargedCentavos: z.number().int().positive().nullable(),
  referenceNamespace: ReferenceNamespace.nullable(),
  referenceValue: z.string().max(80).nullable(),
  payerName: z.string().max(120).nullable(),
  payerPhone: z.string().max(40).nullable(),
  payeeName: z.string().max(120).nullable(),
  payeePhone: z.string().max(40).nullable(),
  receiptTransactionAt: z.string().datetime().nullable(),
  receiptTransactionPrecision: TimePrecision,
  receiptStatus: ReceiptStatus,
});
export type ReceiptFields = z.infer<typeof ReceiptFields>;

/** Names of fields whose edit reopens reconciliation. */
export const MATCHING_CRITICAL_FIELDS = [
  'amountCentavos',
  'currency',
  'referenceNamespace',
  'referenceValue',
  'receiptTransactionAt',
  'receiptProvider',
  'paymentRail',
] as const satisfies ReadonlyArray<keyof ReceiptFields>;

export const OcrBlock = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  /** Normalized bounding box [x, y, w, h] in 0..1 image coordinates. */
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
});

export const OcrResult = z.object({
  engine: z.literal('MLKIT_TEXT_V2'),
  engineVersion: z.string().max(40),
  fullText: z.string().max(20000),
  blocks: z.array(OcrBlock).max(500),
  /** 0..1 heuristic readability score from the parser; low values trigger warnings. */
  readabilityScore: z.number().min(0).max(1),
});
export type OcrResult = z.infer<typeof OcrResult>;

// ---- Proof upload -----------------------------------------------------------

export const InitProofUploadRequest = z.object({
  /** Stable client-generated proof ID. */
  clientProofId: uuid,
  contentType: z.enum(['image/jpeg', 'image/png', 'image/heic', 'image/webp']),
  byteLength: z.number().int().positive().max(25 * 1024 * 1024),
  /** SHA-256 of the exact retained evidence bytes (after EXIF location stripping). */
  sha256: z.string().length(64),
  /** Optional perceptual hash for similarity *warnings* only. */
  perceptualHash: z.string().max(64).nullable().optional(),
});
export type InitProofUploadRequest = z.infer<typeof InitProofUploadRequest>;

export const InitProofUploadResponse = z.object({
  proofId: uuid,
  /** Short-lived signed upload URL to the private bucket. Null if bytes already exist. */
  uploadUrl: z.string().url().nullable(),
  uploadHeaders: z.record(z.string()).default({}),
  alreadyStored: z.boolean(),
  expiresAt: z.string().datetime(),
});
export type InitProofUploadResponse = z.infer<typeof InitProofUploadResponse>;

export const FinalizeProofUploadRequest = z.object({
  proofId: uuid,
});

// ---- Record creation --------------------------------------------------------

export const CreateRecordRequest = z.object({
  /** Stable client-generated record ID; retries/reboots never create a second record. */
  clientRecordId: uuid,
  sourceId: uuid,
  proofId: uuid.nullable(),
  captureOrigin: CaptureOrigin,
  capturedAt: z.string().datetime(),
  /** Device-side app version and parser versions for provenance. */
  appVersion: z.string().max(40),
  receiptParserId: z.string().max(80).nullable(),
  receiptParserVersion: z.string().max(20).nullable(),
  ocr: OcrResult.nullable(),
  /** Fields exactly as the parser produced them. */
  extracted: ReceiptFields,
  /** Fields after the cashier's review. Amount and currency are required to save. */
  corrected: ReceiptFields.extend({
    amountCentavos: z.number().int().positive(),
    currency: z.literal('PHP'),
  }),
  /** Which corrected fields differ from extracted (client asserts; server recomputes). */
  editedFields: z.array(z.string()).default([]),
  customerLabel: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  /** Set when saving an incoming event directly as a record (owner action). */
  fromEventId: uuid.nullable().optional(),
});
export type CreateRecordRequest = z.infer<typeof CreateRecordRequest>;

export const CorrectRecordRequest = z.object({
  corrected: ReceiptFields.partial(),
  customerLabel: z.string().max(120).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  reason: z.string().max(300),
});
export type CorrectRecordRequest = z.infer<typeof CorrectRecordRequest>;

export const VoidRecordRequest = z.object({
  reason: z.string().min(3).max(300),
});

// ---- Record views -----------------------------------------------------------

export const MatchExplanation = z.object({
  kind: MatchKind.nullable(),
  reasonCodes: z.array(MatchReasonCode),
  /** Which identifying fields agreed. */
  supportingFields: z.array(z.string()),
  /** Which identifying fields were missing from either side. */
  missingFields: z.array(z.string()),
  timeBasis: TimeBasis,
  windowSeconds: z.number().int().nullable(),
  matcherVersion: z.string().nullable(),
  /** Required disclosure text for automatic matches. */
  disclosure: z.string().nullable(),
});
export type MatchExplanation = z.infer<typeof MatchExplanation>;

export const RecordSummary = z.object({
  id: uuid,
  organizationId: uuid,
  sourceId: uuid,
  sourceLabel: z.string(),
  evidenceState: EvidenceState,
  flags: z.array(RecordFlag),
  syncStatus: SyncStatus,
  currency: z.literal('PHP'),
  amountCentavos: z.number().int(),
  referenceNamespace: ReferenceNamespace.nullable(),
  referenceValue: z.string().nullable(),
  payerName: z.string().nullable(),
  customerLabel: z.string().nullable(),
  note: z.string().nullable(),
  capturedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  createdByUserId: uuid,
  createdByDisplayName: z.string(),
  receiptTransactionAt: z.string().datetime().nullable(),
  hasProofImage: z.boolean(),
  linkedEventId: uuid.nullable(),
  /** Count of scoped candidates when in REVIEW_REQUIRED / UNVERIFIED. */
  candidateCount: z.number().int().nonnegative(),
});
export type RecordSummary = z.infer<typeof RecordSummary>;

export const RecordDetail = RecordSummary.extend({
  captureOrigin: CaptureOrigin,
  extracted: ReceiptFields,
  corrected: ReceiptFields,
  editedFields: z.array(z.string()),
  matchExplanation: MatchExplanation,
  /** Short-lived signed URL; null when retention expired or no image. */
  proofImageUrl: z.string().url().nullable(),
  proofImageExpiresAt: z.string().datetime().nullable(),
  proofRetentionUntil: z.string().datetime().nullable(),
  voidReason: z.string().nullable(),
  /** Audit trail restricted to this record. */
  history: z.array(
    z.object({
      at: z.string().datetime(),
      action: z.string(),
      actorDisplayName: z.string().nullable(),
      reason: z.string().nullable(),
    }),
  ),
});
export type RecordDetail = z.infer<typeof RecordDetail>;

export const ListRecordsQuery = z.object({
  q: z.string().max(120).optional(),
  state: z.array(EvidenceState).optional(),
  sourceId: uuid.optional(),
  staffUserId: uuid.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).default(30),
});
export type ListRecordsQuery = z.infer<typeof ListRecordsQuery>;

export const ListRecordsResponse = z.object({
  items: z.array(RecordSummary),
  nextCursor: z.string().nullable(),
});
export type ListRecordsResponse = z.infer<typeof ListRecordsResponse>;

export const CreateRecordResponse = z.object({
  record: RecordSummary,
  /** True when this request matched an existing clientRecordId/proof and no new usage was charged. */
  deduplicated: z.boolean(),
  quotaConsumed: z.boolean(),
});
export type CreateRecordResponse = z.infer<typeof CreateRecordResponse>;
