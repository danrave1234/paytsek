import { Injectable } from '@nestjs/common';
import type { CreateEvidenceConnectorRequest, EvidenceConnectorCredential, EvidenceConnectorSummary, Provider } from '@paytsek/contracts';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { deriveConnectorSigningSecret, requireConnectorSigningKey } from './connector-credentials';
import { toConnectorSummary, type ConnectorRow } from './evidence.types';

@Injectable()
export class EvidenceConnectorsService {
  private readonly env = loadEnv();

  constructor(private readonly db: DbService, private readonly audit: AuditService) {}

  async list(orgId: string): Promise<EvidenceConnectorSummary[]> {
    const rows = await this.db.query<ConnectorRow>(
      `select c.*, s.provider from evidence_connectors c join payment_sources s on s.id = c.source_id
        where c.organization_id = $1 order by c.created_at desc`,
      [orgId],
    );
    return rows.rows.map(toConnectorSummary);
  }

  async create(orgId: string, userId: string, input: CreateEvidenceConnectorRequest): Promise<EvidenceConnectorCredential> {
    requireConnectorSigningKey(this.env.EVIDENCE_WEBHOOK_SIGNING_KEY);
    const row = await this.db.tx(async (tx) => {
      const source = await tx.query<{ id: string; provider: Provider }>(
        `select id, provider from payment_sources where id = $1 and organization_id = $2 and deleted_at is null`,
        [input.sourceId, orgId],
      );
      if (!source.rows[0]) throw new ApiException('NOT_FOUND', 'Receiving source not found');
      const created = await tx.query<ConnectorRow>(
        `insert into evidence_connectors (organization_id, source_id, label, adapter, created_by)
         values ($1,$2,$3,$4,$5)
         on conflict (source_id, adapter) where status = 'ACTIVE' do nothing
         returning *, $6::provider as provider`,
        [orgId, input.sourceId, input.label, input.adapter, userId, source.rows[0].provider],
      );
      const connector = created.rows[0];
      if (!connector) throw new ApiException('CONFLICT', 'An active connector already exists for this receiving source');
      await this.audit.record({
        organizationId: orgId, actorUserId: userId, action: 'EVIDENCE_CONNECTOR_CREATED',
        subjectType: 'evidence_connector', subjectId: connector.id,
        after: { sourceId: connector.source_id, adapter: connector.adapter },
      }, tx);
      return connector;
    });
    return this.credential(row);
  }

  async rotate(orgId: string, userId: string, id: string): Promise<EvidenceConnectorCredential> {
    requireConnectorSigningKey(this.env.EVIDENCE_WEBHOOK_SIGNING_KEY);
    const result = await this.db.tx(async (tx) => {
      const updated = await tx.query<ConnectorRow>(
        `update evidence_connectors c set secret_version = secret_version + 1 from payment_sources s
          where c.id = $1 and c.organization_id = $2 and c.status = 'ACTIVE' and s.id = c.source_id
          returning c.*, s.provider`,
        [id, orgId],
      );
      const connector = updated.rows[0];
      if (!connector) throw new ApiException('NOT_FOUND', 'Active evidence connector not found');
      await this.audit.record({
        organizationId: orgId, actorUserId: userId, action: 'EVIDENCE_CONNECTOR_ROTATED',
        subjectType: 'evidence_connector', subjectId: connector.id,
        after: { secretVersion: connector.secret_version },
      }, tx);
      return connector;
    });
    return this.credential(result);
  }

  async revoke(orgId: string, userId: string, id: string): Promise<void> {
    await this.db.tx(async (tx) => {
      const revoked = await tx.query<{ id: string }>(
        `update evidence_connectors set status = 'REVOKED', revoked_at = now()
          where id = $1 and organization_id = $2 and status = 'ACTIVE' returning id`,
        [id, orgId],
      );
      if (!revoked.rows[0]) throw new ApiException('NOT_FOUND', 'Active evidence connector not found');
      await this.audit.record({
        organizationId: orgId, actorUserId: userId, action: 'EVIDENCE_CONNECTOR_REVOKED',
        subjectType: 'evidence_connector', subjectId: id,
      }, tx);
    });
  }

  private credential(row: ConnectorRow): EvidenceConnectorCredential {
    return {
      connector: toConnectorSummary(row),
      signingSecret: deriveConnectorSigningSecret(this.env.EVIDENCE_WEBHOOK_SIGNING_KEY, row.id, row.secret_version),
      signatureHeader: 'paytsek-signature',
    };
  }
}
