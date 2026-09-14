import { Injectable } from '@nestjs/common';
import type { ConfigureCurrentCollectorRequest, ConfigureCurrentCollectorResponse, Provider } from '@paytsek/contracts';
import { generateCollectorCredential, hashSecret } from '../auth/credentials';
import { ApiException } from '../common/errors';
import { AuditService } from '../db/audit.service';
import { DbService, type Queryable } from '../db/db.service';

type SourceRow = { id: string; provider: Provider; collection_paused: boolean };

/** Direct listener setup for the signed-in owner's current Android phone. */
@Injectable()
export class CurrentCollectorService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async configure(
    orgId: string,
    ownerId: string,
    input: ConfigureCurrentCollectorRequest,
  ): Promise<ConfigureCurrentCollectorResponse> {
    const providers = [...new Set(input.providers)];
    const credential = generateCollectorCredential();

    return this.db.tx(async (tx) => {
      await tx.query(`select id from organizations where id = $1 for update`, [orgId]);
      const device = await tx.query<{ id: string }>(
        `insert into devices (organization_id, install_id, label, platform, capability, status, app_version, os_version, device_model, provider_apps, credential_hash, credential_rotated_at, last_server_contact_at)
         values ($1,$2,'This phone','ANDROID','BOTH','ACTIVE',$3,$4,$5,$6,$7,now(),now())
         on conflict (organization_id, install_id) do update set
           label = 'This phone', platform = 'ANDROID', capability = 'BOTH', status = 'ACTIVE',
           app_version = excluded.app_version, os_version = excluded.os_version,
           device_model = excluded.device_model, provider_apps = excluded.provider_apps,
           credential_hash = excluded.credential_hash, credential_rotated_at = now(),
           revoked_at = null, revoked_reason = null, last_server_contact_at = now()
         returning id`,
        [orgId, input.deviceInstallId, input.appVersion, input.osVersion, input.deviceModel ?? null, JSON.stringify(input.detectedProviderApps), hashSecret(credential)],
      );
      const deviceId = device.rows[0]!.id;
      const existing = await tx.query<SourceRow>(
        `select id, provider, collection_paused from payment_sources
          where organization_id = $1 and deleted_at is null for update`,
        [orgId],
      );
      const sources = new Map(existing.rows.map((source) => [source.provider, source]));

      for (const provider of providers) {
        const source = await this.ensureSource(tx, sources, orgId, ownerId, provider);
        const active = await tx.query<{ device_id: string }>(
          `select device_id from device_bindings where source_id = $1 and status = 'ACTIVE'`,
          [source.id],
        );
        if (active.rows[0] && active.rows[0].device_id !== deviceId) {
          throw new ApiException('SOURCE_ALREADY_HAS_COLLECTOR', `${provider} notifications are already listened to on another phone. Disconnect that phone first.`);
        }
        if (!active.rows[0]) {
          await tx.query(`insert into device_bindings (organization_id, device_id, source_id) values ($1,$2,$3)`, [orgId, deviceId, source.id]);
        }
      }

      // A toggle never changes a separately paired phone.
      for (const source of existing.rows.filter((item) => !providers.includes(item.provider))) {
        const revoked = await tx.query(
          `update device_bindings set status = 'REVOKED', revoked_at = now()
            where source_id = $1 and device_id = $2 and status = 'ACTIVE'`,
          [source.id, deviceId],
        );
        if (revoked.rowCount) await tx.query(`update payment_sources set collection_paused = true where id = $1`, [source.id]);
      }

      await this.audit.record({
        organizationId: orgId,
        actorUserId: ownerId,
        actorDeviceId: deviceId,
        action: 'DEVICE_APPROVED',
        subjectType: 'device',
        subjectId: deviceId,
        after: { setup: 'current-phone', providers },
      }, tx);
      return { deviceId, collectorCredential: credential, providers };
    });
  }

  private async ensureSource(
    tx: Queryable,
    sources: Map<Provider, SourceRow>,
    orgId: string,
    ownerId: string,
    provider: Provider,
  ): Promise<SourceRow> {
    const existing = sources.get(provider);
    if (existing) {
      if (existing.collection_paused) await tx.query(`update payment_sources set collection_paused = false where id = $1`, [existing.id]);
      return existing;
    }
    const label = provider === 'GCASH' ? 'GCash' : provider === 'GOTYME' ? 'GoTyme' : provider === 'MAYA' ? 'Maya' : 'MariBank';
    const inserted = await tx.query<SourceRow>(
      `insert into payment_sources (organization_id, provider, label, declared_identifier, masked_display, recipient_aliases, is_default, collection_paused)
       values ($1,$2,$3,$4,'This phone','{}',$5,false)
       returning id, provider, collection_paused`,
      [orgId, provider, label, `current-phone:${provider}`, sources.size === 0],
    );
    const source = inserted.rows[0]!;
    sources.set(provider, source);
    await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'SOURCE_CREATED', subjectType: 'payment_source', subjectId: source.id, after: { provider, setup: 'current-phone' } }, tx);
    return source;
  }
}
