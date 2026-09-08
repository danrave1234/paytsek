import { z } from 'zod';
import { ExportFormat, MembershipRole, PlanCode, Provider } from '../enums';
import { uuid } from './pairing';

export const CreateWorkspaceRequest = z.object({
  name: z.string().min(1).max(80),
  timezone: z.string().max(60).default('Asia/Manila'),
  ownerDisplayName: z.string().min(1).max(80),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequest>;

export const WorkspaceSummary = z.object({
  id: uuid,
  name: z.string(),
  timezone: z.string(),
  role: MembershipRole,
  planCode: PlanCode,
  isDemo: z.boolean(),
  createdAt: z.string().datetime(),
});
export type WorkspaceSummary = z.infer<typeof WorkspaceSummary>;

export const MemberSummary = z.object({
  userId: uuid,
  displayName: z.string(),
  email: z.string().email().nullable(),
  role: MembershipRole,
  /** Owner setting: may this cashier confirm proposed matches without owner approval? */
  canConfirmMatches: z.boolean(),
  joinedAt: z.string().datetime(),
});
export type MemberSummary = z.infer<typeof MemberSummary>;

export const InviteMemberRequest = z.object({
  email: z.string().email(),
  role: MembershipRole,
  canConfirmMatches: z.boolean().default(false),
});
export type InviteMemberRequest = z.infer<typeof InviteMemberRequest>;

export const UpdateMemberRequest = z.object({
  role: MembershipRole.optional(),
  canConfirmMatches: z.boolean().optional(),
});
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequest>;

export const AcceptInviteRequest = z.object({
  inviteToken: z.string().min(16).max(128),
});

// ---- Receiving sources -----------------------------------------------------

export const CreateSourceRequest = z.object({
  provider: Provider,
  label: z.string().min(1).max(60),
  /** Owner-declared account identifier (e.g. mobile number). Owner-configured, not provider-verified. */
  declaredIdentifier: z.string().min(3).max(60),
  /** Masked value shown in UI, e.g. "09•• ••• 1234". */
  maskedDisplay: z.string().min(3).max(40),
  /** Names the seller is known by on receipts (payee aliases). */
  recipientAliases: z.array(z.string().max(80)).max(10).default([]),
  isDefault: z.boolean().default(false),
});
export type CreateSourceRequest = z.infer<typeof CreateSourceRequest>;

export const UpdateSourceRequest = CreateSourceRequest.partial().extend({
  /** Pause automatic collection for this source without unpairing. */
  collectionPaused: z.boolean().optional(),
  /** Require owner approval before an event is associated with a staff-created record. */
  requireOwnerApprovalForStaffMatches: z.boolean().optional(),
});
export type UpdateSourceRequest = z.infer<typeof UpdateSourceRequest>;

export const SourceSummary = z.object({
  id: uuid,
  provider: Provider,
  label: z.string(),
  maskedDisplay: z.string(),
  recipientAliases: z.array(z.string()),
  isDefault: z.boolean(),
  collectionPaused: z.boolean(),
  requireOwnerApprovalForStaffMatches: z.boolean(),
  /** Per-flow automatic matching capability as resolved from the registry. */
  autoMatchFlows: z.array(z.string()),
  activeCollectorDeviceId: uuid.nullable(),
  collectorLastSeenAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type SourceSummary = z.infer<typeof SourceSummary>;

// ---- Home dashboard ---------------------------------------------------------

export const HomeSummary = z.object({
  /** Recorded-payment totals — not wallet balance or guaranteed revenue. */
  today: z.object({
    notificationMatchedCount: z.number().int(),
    notificationMatchedCentavos: z.number().int(),
    confirmedManuallyCount: z.number().int(),
    confirmedManuallyCentavos: z.number().int(),
    unverifiedCount: z.number().int(),
    unverifiedCentavos: z.number().int(),
    reviewRequiredCount: z.number().int(),
  }),
  collectors: z.array(
    z.object({
      deviceId: uuid,
      label: z.string(),
      sourceLabel: z.string(),
      lastSeenAt: z.string().datetime().nullable(),
      stale: z.boolean(),
      pendingUploadCount: z.number().int().nullable(),
      notificationAccessGranted: z.boolean().nullable(),
    }),
  ),
  quota: z.object({
    monthlyAllowance: z.number().int(),
    monthlyUsed: z.number().int(),
    prepaidCreditsRemaining: z.number().int(),
  }),
});
export type HomeSummary = z.infer<typeof HomeSummary>;

// ---- Exports ----------------------------------------------------------------

export const CreateExportRequest = z.object({
  format: ExportFormat,
  from: z.string().datetime(),
  to: z.string().datetime(),
  sourceId: uuid.optional(),
  includeVoided: z.boolean().default(false),
});
export type CreateExportRequest = z.infer<typeof CreateExportRequest>;

export const ExportJobView = z.object({
  id: uuid,
  status: z.enum(['PENDING', 'RUNNING', 'READY', 'FAILED', 'EXPIRED']),
  format: ExportFormat,
  createdAt: z.string().datetime(),
  /** Short-lived signed URL when READY. Exports expire and are deleted after 24 hours. */
  downloadUrl: z.string().url().nullable(),
  expiresAt: z.string().datetime().nullable(),
  rowCount: z.number().int().nullable(),
  errorCode: z.string().nullable(),
});
export type ExportJobView = z.infer<typeof ExportJobView>;
