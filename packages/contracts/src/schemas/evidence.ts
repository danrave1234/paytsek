import { z } from 'zod';
import { PaymentRail, Provider, ReferenceNamespace } from '../enums';
import { uuid } from './pairing';

export const EvidenceConnectorAdapter = z.enum(['GENERIC_HMAC_V1']);
export type EvidenceConnectorAdapter = z.infer<typeof EvidenceConnectorAdapter>;

export const EvidenceConnectorStatus = z.enum(['ACTIVE', 'REVOKED']);
export type EvidenceConnectorStatus = z.infer<typeof EvidenceConnectorStatus>;

export const CreateEvidenceConnectorRequest = z.object({
  sourceId: uuid,
  label: z.string().trim().min(1).max(60),
  adapter: EvidenceConnectorAdapter.default('GENERIC_HMAC_V1'),
}).strict();
export type CreateEvidenceConnectorRequest = z.infer<typeof CreateEvidenceConnectorRequest>;

export const EvidenceConnectorSummary = z.object({
  id: uuid,
  sourceId: uuid,
  provider: Provider,
  label: z.string(),
  adapter: EvidenceConnectorAdapter,
  status: EvidenceConnectorStatus,
  secretVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EvidenceConnectorSummary = z.infer<typeof EvidenceConnectorSummary>;

/** The secret is returned only on create/rotate and must be stored by the partner. */
export const EvidenceConnectorCredential = z.object({
  connector: EvidenceConnectorSummary,
  signingSecret: z.string().min(32),
  signatureHeader: z.literal('paytsek-signature'),
});
export type EvidenceConnectorCredential = z.infer<typeof EvidenceConnectorCredential>;

export const EvidenceWebhookStatus = z.enum(['SUCCEEDED', 'REVERSED', 'REFUNDED']);
export type EvidenceWebhookStatus = z.infer<typeof EvidenceWebhookStatus>;

/**
 * Minimal, provider-neutral payment event. It deliberately excludes payer
 * names, phone numbers, wallet text, credentials and balance information.
 */
export const IncomingEvidenceWebhook = z.object({
  eventId: z.string().trim().min(1).max(160),
  paymentId: z.string().trim().min(1).max(160),
  status: EvidenceWebhookStatus,
  amountCentavos: z.number().int().positive(),
  currency: z.literal('PHP'),
  occurredAt: z.string().datetime(),
  paymentRail: PaymentRail.default('UNKNOWN'),
  referenceNamespace: ReferenceNamespace.default('UNKNOWN'),
  referenceValue: z.string().trim().min(3).max(120).nullable().default(null),
}).strict();
export type IncomingEvidenceWebhook = z.infer<typeof IncomingEvidenceWebhook>;

export const EvidenceWebhookAck = z.object({
  ok: z.literal(true),
  outcome: z.enum(['ACCEPTED', 'DUPLICATE']),
});
export type EvidenceWebhookAck = z.infer<typeof EvidenceWebhookAck>;
