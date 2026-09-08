import { z } from 'zod';

/** Stable, versioned error codes. Clients branch on these, never on messages. */
export const ApiErrorCode = z.enum([
  // auth / tenancy
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'WORKSPACE_REQUIRED',
  'NOT_A_MEMBER',
  'OWNER_ONLY',
  'COLLECTOR_CREDENTIAL_REVOKED',
  'COLLECTOR_SCOPE_VIOLATION',
  // validation
  'VALIDATION_FAILED',
  'UNSUPPORTED_API_VERSION',
  // pairing
  'PAIRING_CODE_INVALID',
  'PAIRING_CODE_EXPIRED',
  'PAIRING_ALREADY_CONSUMED',
  'PAIRING_RATE_LIMITED',
  'PAIRING_NOT_APPROVED',
  'SOURCE_ALREADY_HAS_COLLECTOR',
  // records / proofs
  'RECORD_NOT_FOUND',
  'RECORD_VOIDED',
  'PROOF_UPLOAD_NOT_FINALIZED',
  'DUPLICATE_SUBMISSION',
  'IDEMPOTENCY_CONFLICT',
  // matching
  'EVENT_NOT_FOUND',
  'EVENT_ALREADY_LINKED',
  'RECORD_ALREADY_LINKED',
  'CANDIDATE_OUT_OF_SCOPE',
  'MATCH_CONFLICT',
  'CONFIRMATION_REQUIRES_OWNER_APPROVAL',
  // billing / quota
  'QUOTA_EXHAUSTED',
  'PLAN_LIMIT_DEVICES',
  'PLAN_LIMIT_SOURCES',
  'PLAN_LIMIT_MEMBERS',
  'PURCHASE_NOT_VERIFIED',
  'PURCHASE_ALREADY_APPLIED',
  'SUBSCRIPTION_OTHER_WORKSPACE',
  'WEBHOOK_UNAUTHORIZED',
  // exports
  'EXPORT_NOT_READY',
  'EXPORT_EXPIRED',
  // misc
  'RATE_LIMITED',
  'NOT_FOUND',
  'CONFLICT',
  'INTERNAL',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorBody = z.object({
  code: ApiErrorCode,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  requestId: z.string().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const API_VERSION = 'v1' as const;
export const API_VERSION_HEADER = 'x-payrecord-api-version' as const;
export const WORKSPACE_HEADER = 'x-payrecord-workspace' as const;
export const IDEMPOTENCY_HEADER = 'idempotency-key' as const;
