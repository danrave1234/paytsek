import { Injectable } from '@nestjs/common';
import type {
  AcceptPairingRequest,
  AcceptPairingResponse,
  CollectorHealthReport,
  CreatePairingSessionRequest,
  CreatePairingSessionResponse,
  DeviceSummary,
  Provider,
} from '@paytsek/contracts';
import { generateCollectorCredential, generatePairingCode, hashSecret, normalizePairingCode } from '../auth/credentials';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';

interface SessionRow {
  id: string;
  organization_id: string;
  source_id: string;
  requested_capability: DeviceSummary['capability'];
  device_label: string | null;
  state: AcceptPairingResponse['state'];
  expires_at: Date;
  accepted_device_id: string | null;
  accepted_payload: AcceptPairingRequest | null;
  attempt_count: number;
}

@Injectable()
export class PairingService {
  private readonly env = loadEnv();

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  // ---- Owner: create a session -------------------------------------------------
  async createSession(orgId: string, ownerId: string, input: CreatePairingSessionRequest): Promise<CreatePairingSessionResponse> {
    const source = await this.db.one<{ id: string }>(`select id from payment_sources where id = $1 and organization_id = $2 and deleted_at is null`, [input.sourceId, orgId]);
    if (!source) throw new ApiException('NOT_FOUND', 'Source not found');
    if (input.requestedCapability !== 'SCANNER') {
      const bound = await this.db.one<{ device_id: string }>(`select device_id from device_bindings where source_id = $1 and status = 'ACTIVE'`, [input.sourceId]);
      if (bound) throw new ApiException('SOURCE_ALREADY_HAS_COLLECTOR', 'This source already has an active collector. Revoke it first to pair another phone.');
    }
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + this.env.PAIRING_CODE_TTL_SECONDS * 1000);
    // Invalidate older pending sessions for the same source.
    await this.db.query(`update pairing_sessions set state = 'EXPIRED' where source_id = $1 and state = 'PENDING'`, [input.sourceId]);
    const r = await this.db.query<{ id: string }>(
      `insert into pairing_sessions (organization_id, source_id, requested_capability, device_label, code_hash, created_by, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [orgId, input.sourceId, input.requestedCapability, input.deviceLabel ?? null, hashSecret(normalizePairingCode(code)), ownerId, expiresAt],
    );
    return {
      pairingSessionId: r.rows[0]!.id,
      code,
      qrPayload: `paytsek://pair?c=${encodeURIComponent(code)}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  // ---- Device: accept with the short code (unauthenticated, rate limited) -----
  async accept(input: AcceptPairingRequest, ipBucket: string): Promise<AcceptPairingResponse> {
    await this.rateLimit([`ip:${ipBucket}`, `install:${input.deviceInstallId}`]);
    const codeHash = hashSecret(normalizePairingCode(input.code));
    return this.db.tx(async (c) => {
      const s = await c.query<SessionRow & { org_name: string; source_label: string; provider: Provider }>(
        `select ps.*, o.name as org_name, src.label as source_label, src.provider
           from pairing_sessions ps
           join organizations o on o.id = ps.organization_id
           join payment_sources src on src.id = ps.source_id
          where ps.code_hash = $1 for update of ps`,
        [codeHash],
      );
      const row = s.rows[0];
      if (!row) throw new ApiException('PAIRING_CODE_INVALID', 'Pairing code not recognized');
      if (row.state !== 'PENDING') throw new ApiException('PAIRING_ALREADY_CONSUMED', 'This pairing code was already used');
      if (row.expires_at.getTime() < Date.now()) {
        await c.query(`update pairing_sessions set state = 'EXPIRED' where id = $1`, [row.id]);
        throw new ApiException('PAIRING_CODE_EXPIRED', 'Pairing code expired. Ask the owner for a new one.');
      }
      if (row.requested_capability !== 'SCANNER' && input.platform !== 'ANDROID') {
        throw new ApiException('VALIDATION_FAILED', 'Only an Android phone can act as a payment collector');
      }
      // Upsert device (pending approval; no credential yet).
      const d = await c.query<{ id: string }>(
        `insert into devices (organization_id, install_id, label, platform, capability, status, app_version, os_version, device_model, provider_apps)
         values ($1,$2,$3,$4,$5,'PAUSED',$6,$7,$8,$9)
         on conflict (organization_id, install_id) do update set
           label = excluded.label, platform = excluded.platform, capability = excluded.capability,
           app_version = excluded.app_version, os_version = excluded.os_version, device_model = excluded.device_model,
           provider_apps = excluded.provider_apps, revoked_at = null, revoked_reason = null, status = 'PAUSED'
         returning id`,
        [row.organization_id, input.deviceInstallId, row.device_label ?? input.deviceModel ?? 'Payment phone', input.platform, row.requested_capability, input.appVersion, input.osVersion, input.deviceModel ?? null, JSON.stringify(input.detectedProviderApps)],
      );
      const deviceId = d.rows[0]!.id;
      await c.query(
        `update pairing_sessions set state = 'ACCEPTED', accepted_at = now(), accepted_device_id = $2, accepted_payload = $3 where id = $1`,
        [row.id, deviceId, JSON.stringify({ ...input, code: undefined })],
      );
      await this.audit.record({ organizationId: row.organization_id, actorDeviceId: deviceId, action: 'DEVICE_PAIRED', subjectType: 'device', subjectId: deviceId, after: { platform: input.platform, capability: row.requested_capability } }, c);
      return {
        pairingSessionId: row.id,
        state: 'ACCEPTED',
        workspaceName: row.org_name,
        sourceLabel: row.source_label,
        provider: row.provider,
        requestedCapability: row.requested_capability,
        deviceId,
      };
    });
  }

  // ---- Owner: approve / reject ------------------------------------------------
  async approve(orgId: string, ownerId: string, sessionId: string, approve: boolean): Promise<{ state: string }> {
    return this.db.tx(async (c) => {
      const s = await c.query<SessionRow>(`select * from pairing_sessions where id = $1 and organization_id = $2 for update`, [sessionId, orgId]);
      const row = s.rows[0];
      if (!row) throw new ApiException('NOT_FOUND', 'Pairing session not found');
      if (row.state !== 'ACCEPTED' || !row.accepted_device_id) throw new ApiException('CONFLICT', 'The device has not accepted this code yet');
      if (!approve) {
        await c.query(`update pairing_sessions set state = 'REJECTED' where id = $1`, [row.id]);
        await c.query(`update devices set status = 'REVOKED', revoked_at = now(), revoked_reason = 'pairing rejected' where id = $1`, [row.accepted_device_id]);
        return { state: 'REJECTED' };
      }
      // Plan slot checks. An Android BOTH device uses one scanner slot and one collector slot.
      const lim = await c.query<{ scanner_devices: number; collector_devices: number; scanners: number; collectors: number }>(
        `select p.scanner_devices, p.collector_devices,
                (select count(*) from devices where organization_id = $1 and status <> 'REVOKED' and capability in ('SCANNER','BOTH') and id <> $2)::int as scanners,
                (select count(*) from devices where organization_id = $1 and status <> 'REVOKED' and capability in ('COLLECTOR','BOTH') and id <> $2)::int as collectors
           from organizations o join plans p on p.code = o.plan_code where o.id = $1 for update of o`,
        [orgId, row.accepted_device_id],
      );
      const l = lim.rows[0]!;
      const cap = row.requested_capability;
      if ((cap === 'SCANNER' || cap === 'BOTH') && l.scanners >= l.scanner_devices) throw new ApiException('PLAN_LIMIT_DEVICES', `Your plan allows ${l.scanner_devices} scanner device(s)`);
      if ((cap === 'COLLECTOR' || cap === 'BOTH') && l.collectors >= l.collector_devices) throw new ApiException('PLAN_LIMIT_DEVICES', `Your plan allows ${l.collector_devices} collector device(s)`);

      if (cap !== 'SCANNER') {
        try {
          await c.query(`insert into device_bindings (organization_id, device_id, source_id) values ($1,$2,$3)`, [orgId, row.accepted_device_id, row.source_id]);
        } catch (e) {
          if (isUniqueViolation(e, 'device_bindings_one_active_per_source_idx')) throw new ApiException('SOURCE_ALREADY_HAS_COLLECTOR', 'This source already has an active collector');
          throw e;
        }
      }
      await c.query(`update devices set status = 'ACTIVE' where id = $1`, [row.accepted_device_id]);
      await c.query(`update pairing_sessions set state = 'APPROVED', approved_at = now(), approved_by = $2 where id = $1`, [row.id, ownerId]);
      await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'DEVICE_APPROVED', subjectType: 'device', subjectId: row.accepted_device_id, after: { sourceId: row.source_id, capability: cap } }, c);
      return { state: 'APPROVED' };
    });
  }

  // ---- Device: poll status; credential is minted exactly once ---------------
  async poll(sessionId: string, deviceInstallId: string, code: string): Promise<AcceptPairingResponse> {
    const codeHash = hashSecret(normalizePairingCode(code));
    return this.db.tx(async (c) => {
      const s = await c.query<SessionRow & { org_name: string; source_label: string; provider: Provider; install_id: string }>(
        `select ps.*, o.name as org_name, src.label as source_label, src.provider, d.install_id
           from pairing_sessions ps
           join organizations o on o.id = ps.organization_id
           join payment_sources src on src.id = ps.source_id
           left join devices d on d.id = ps.accepted_device_id
          where ps.id = $1 and ps.code_hash = $2 for update of ps`,
        [sessionId, codeHash],
      );
      const row = s.rows[0];
      if (!row || row.install_id !== deviceInstallId) throw new ApiException('PAIRING_CODE_INVALID', 'Pairing session not found');
      const base: AcceptPairingResponse = {
        pairingSessionId: row.id,
        state: row.state,
        workspaceName: row.org_name,
        sourceLabel: row.source_label,
        provider: row.provider,
        requestedCapability: row.requested_capability,
        deviceId: row.accepted_device_id ?? undefined,
      };
      if (row.state !== 'APPROVED' || !row.accepted_device_id) return base;
      if (row.requested_capability === 'SCANNER') {
        await c.query(`update pairing_sessions set state = 'CONSUMED', consumed_at = now() where id = $1`, [row.id]);
        return { ...base, state: 'CONSUMED' };
      }
      const credential = generateCollectorCredential();
      await c.query(`update devices set credential_hash = $2, credential_rotated_at = now() where id = $1`, [row.accepted_device_id, hashSecret(credential)]);
      await c.query(`update pairing_sessions set state = 'CONSUMED', consumed_at = now() where id = $1`, [row.id]);
      return { ...base, state: 'CONSUMED', collectorCredential: credential };
    });
  }

  // ---- Collector: rotate own credential -----------------------------------------
  async rotate(deviceId: string): Promise<{ collectorCredential: string }> {
    const credential = generateCollectorCredential();
    await this.db.query(`update devices set credential_hash = $2, credential_rotated_at = now() where id = $1 and status <> 'REVOKED'`, [deviceId, hashSecret(credential)]);
    return { collectorCredential: credential };
  }

  // ---- Collector: health -----------------------------------------------------------
  async health(deviceId: string, report: CollectorHealthReport): Promise<void> {
    await this.db.query(
      `update devices set app_version = $2, listener_connected = $3, notification_access_granted = $4, pending_upload_count = $5,
              last_observed_event_at = coalesce($6, last_observed_event_at), diagnostic_reason = $7, provider_apps = $8, last_server_contact_at = now()
        where id = $1`,
      [deviceId, report.appVersion, report.listenerConnected, report.notificationAccessGranted, report.pendingUploadCount, report.lastObservedEventAt, report.diagnosticReason ?? null, JSON.stringify(report.providerApps)],
    );
  }

  // ---- Owner: list / revoke / pause -----------------------------------------------
  async listDevices(orgId: string): Promise<DeviceSummary[]> {
    const r = await this.db.query<{
      id: string; label: string; platform: DeviceSummary['platform']; capability: DeviceSummary['capability']; status: DeviceSummary['status'];
      app_version: string | null; last_server_contact_at: Date | null; last_observed_event_at: Date | null; pending_upload_count: number | null;
      listener_connected: boolean | null; notification_access_granted: boolean | null; diagnostic_reason: string | null; bound: string[] | null;
    }>(
      `select d.*, array_remove(array_agg(b.source_id) filter (where b.status = 'ACTIVE'), null) as bound
         from devices d left join device_bindings b on b.device_id = d.id
        where d.organization_id = $1 group by d.id order by d.created_at`,
      [orgId],
    );
    return r.rows.map((d) => ({
      id: d.id, label: d.label, platform: d.platform, capability: d.capability, status: d.status, appVersion: d.app_version,
      lastServerContactAt: d.last_server_contact_at?.toISOString() ?? null, lastObservedEventAt: d.last_observed_event_at?.toISOString() ?? null,
      pendingUploadCount: d.pending_upload_count, listenerConnected: d.listener_connected, notificationAccessGranted: d.notification_access_granted,
      diagnosticReason: d.diagnostic_reason, boundSourceIds: d.bound ?? [],
    }));
  }

  async setStatus(orgId: string, ownerId: string, deviceId: string, status: 'ACTIVE' | 'PAUSED' | 'REVOKED', reason?: string): Promise<void> {
    await this.db.tx(async (c) => {
      const d = await c.query<{ id: string }>(`select id from devices where id = $1 and organization_id = $2 for update`, [deviceId, orgId]);
      if (!d.rows[0]) throw new ApiException('NOT_FOUND', 'Device not found');
      if (status === 'REVOKED') {
        await c.query(`update devices set status = 'REVOKED', revoked_at = now(), revoked_reason = $2, credential_hash = null where id = $1`, [deviceId, reason ?? 'revoked by owner']);
        await c.query(`update device_bindings set status = 'REVOKED', revoked_at = now() where device_id = $1 and status = 'ACTIVE'`, [deviceId]);
      } else {
        await c.query(`update devices set status = $2 where id = $1 and status <> 'REVOKED'`, [deviceId, status]);
      }
      await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: status === 'REVOKED' ? 'DEVICE_REVOKED' : 'DEVICE_PAUSED', subjectType: 'device', subjectId: deviceId, after: { status }, reason: reason ?? null }, c);
    });
  }

  /** Scanner-only devices (any platform) register for slot accounting; no credential is issued. */
  async registerScanner(orgId: string, installId: string, platform: DeviceSummary['platform'], label: string, appVersion: string, osVersion: string): Promise<{ deviceId: string }> {
    return this.db.tx(async (c) => {
      const existing = await c.query<{ id: string }>(`select id from devices where organization_id = $1 and install_id = $2`, [orgId, installId]);
      if (existing.rows[0]) {
        await c.query(`update devices set app_version = $2, os_version = $3, last_server_contact_at = now() where id = $1`, [existing.rows[0].id, appVersion, osVersion]);
        return { deviceId: existing.rows[0].id };
      }
      const lim = await c.query<{ scanner_devices: number; n: number }>(
        `select p.scanner_devices, (select count(*) from devices where organization_id = $1 and status <> 'REVOKED' and capability in ('SCANNER','BOTH'))::int as n
           from organizations o join plans p on p.code = o.plan_code where o.id = $1 for update of o`,
        [orgId],
      );
      const l = lim.rows[0]!;
      if (l.n >= l.scanner_devices) throw new ApiException('PLAN_LIMIT_DEVICES', `Your plan allows ${l.scanner_devices} scanner device(s)`);
      const ins = await c.query<{ id: string }>(
        `insert into devices (organization_id, install_id, label, platform, capability, status, app_version, os_version, last_server_contact_at)
         values ($1,$2,$3,$4,'SCANNER','ACTIVE',$5,$6,now()) returning id`,
        [orgId, installId, label, platform, appVersion, osVersion],
      );
      return { deviceId: ins.rows[0]!.id };
    });
  }

  private async rateLimit(buckets: string[]): Promise<void> {
    const max = this.env.PAIRING_MAX_ATTEMPTS_PER_15MIN;
    for (const b of buckets) {
      const r = await this.db.one<{ n: number }>(`select count(*)::int as n from pairing_attempts where bucket = $1 and attempted_at > now() - interval '15 minutes'`, [b]);
      if ((r?.n ?? 0) >= max) throw new ApiException('PAIRING_RATE_LIMITED', 'Too many pairing attempts. Try again later.');
      await this.db.query(`insert into pairing_attempts (bucket) values ($1)`, [b]);
    }
  }
}
