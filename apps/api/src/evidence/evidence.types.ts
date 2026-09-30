import type { EvidenceConnectorSummary, EvidenceWebhookStatus, Provider } from '@paytsek/contracts';

export type ConnectorRow = {
  id: string;
  organization_id: string;
  source_id: string;
  provider: Provider;
  label: string;
  adapter: 'GENERIC_HMAC_V1';
  status: 'ACTIVE' | 'REVOKED';
  secret_version: number;
  created_at: Date;
  updated_at: Date;
};

export type StoredEvidenceEvent = {
  id: string;
  external_event_id: string | null;
  external_payment_id: string | null;
  event_status: EvidenceWebhookStatus;
  amount_centavos: string;
  currency: string;
};

export const toConnectorSummary = (row: ConnectorRow): EvidenceConnectorSummary => ({
  id: row.id,
  sourceId: row.source_id,
  provider: row.provider,
  label: row.label,
  adapter: row.adapter,
  status: row.status,
  secretVersion: row.secret_version,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
