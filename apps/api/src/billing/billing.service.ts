import { Injectable, Logger } from '@nestjs/common';
import type { BillingProduct, LedgerEntry, PlanCode, SubscriptionStatus, UsageSummary } from '@payrecord/contracts';
import { PREPAID_PACK } from '@payrecord/contracts';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';

/** RevenueCat app user id is workspace-scoped so a purchase maps to exactly one workspace. */
export function revenueCatAppUserIdFor(orgId: string): string {
  return `prw_${orgId}`;
}

interface RcSubscriber {
  subscriber: {
    original_app_user_id: string;
    entitlements: Record<string, { expires_date: string | null; product_identifier: string; purchase_date: string; grace_period_expires_date?: string | null }>;
    subscriptions: Record<string, { expires_date: string | null; purchase_date: string; original_purchase_date: string; store: string; unsubscribe_detected_at: string | null; billing_issues_detected_at: string | null; refunded_at?: string | null; period_type: string; original_transaction_id?: string }>;
    non_subscriptions: Record<string, Array<{ id: string; purchase_date: string; store: string; is_sandbox: boolean; refunded_at?: string | null }>>;
  };
}

@Injectable()
export class BillingService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  products(): BillingProduct[] {
    return [
      { key: 'SOLO_MONTHLY', storeProductId: this.env.BILLING_PRODUCT_SOLO_MONTHLY, kind: 'SUBSCRIPTION', planCode: 'SOLO', records: 1000, localizedPrice: null },
      { key: 'TEAM_MONTHLY', storeProductId: this.env.BILLING_PRODUCT_TEAM_MONTHLY, kind: 'SUBSCRIPTION', planCode: 'TEAM', records: 5000, localizedPrice: null },
      { key: PREPAID_PACK.productKey, storeProductId: this.env.BILLING_PRODUCT_PACK_500, kind: 'CONSUMABLE', planCode: null, records: PREPAID_PACK.records, localizedPrice: null },
    ];
  }

  private planForProduct(productId: string): PlanCode | null {
    if (productId === this.env.BILLING_PRODUCT_SOLO_MONTHLY) return 'SOLO';
    if (productId === this.env.BILLING_PRODUCT_TEAM_MONTHLY) return 'TEAM';
    return null;
  }

  async usage(orgId: string): Promise<UsageSummary> {
    const r = await this.db.one<{
      plan_code: PlanCode; status: SubscriptionStatus | null; store: string | null; period_start: Date; allowance: number; used: number; credits: number;
      scanner_devices: number; collector_devices: number; receiving_sources: number; members: number; scanners: number; collectors: number; sources: number; member_count: number;
    }>(
      `select o.plan_code, s.status, s.store, current_period_start(o.id) as period_start, p.monthly_record_allowance as allowance,
              monthly_used(o.id, current_period_start(o.id)) as used, prepaid_credits_remaining(o.id) as credits,
              p.scanner_devices, p.collector_devices, p.receiving_sources, p.members,
              (select count(*) from devices where organization_id = o.id and status <> 'REVOKED' and capability in ('SCANNER','BOTH'))::int as scanners,
              (select count(*) from devices where organization_id = o.id and status <> 'REVOKED' and capability in ('COLLECTOR','BOTH'))::int as collectors,
              (select count(*) from payment_sources where organization_id = o.id and deleted_at is null)::int as sources,
              (select count(*) from memberships where organization_id = o.id)::int as member_count
         from organizations o join plans p on p.code = o.plan_code
         left join subscriptions s on s.organization_id = o.id and s.status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY')
        where o.id = $1`,
      [orgId],
    );
    if (!r) throw new ApiException('NOT_FOUND', 'Workspace not found');
    const start = new Date(r.period_start);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const ratio = r.allowance > 0 ? r.used / r.allowance : 1;
    return {
      planCode: r.plan_code,
      subscriptionStatus: r.status ?? 'NONE',
      managementPlatform: r.store === 'APP_STORE' || r.store === 'PLAY_STORE' ? r.store : null,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      monthlyAllowance: r.allowance,
      monthlyUsed: r.used,
      prepaidCreditsRemaining: r.credits,
      warnLevelsCrossed: [0.8, 1.0].filter((t) => ratio >= t),
      limits: { scannerDevices: r.scanner_devices, collectorDevices: r.collector_devices, receivingSources: r.receiving_sources, members: r.members },
      usage: { scannerDevices: r.scanners, collectorDevices: r.collectors, receivingSources: r.sources, members: r.member_count },
    };
  }

  async ledger(orgId: string, limit = 100): Promise<LedgerEntry[]> {
    const r = await this.db.query<{ id: string; created_at: Date; kind: string; delta: number; record_id: string | null; store_transaction_id: string | null; reason: string | null }>(
      `select id, created_at, case when kind = 'USAGE' then 'USAGE' when kind = 'ADJUSTMENT' then 'ADJUSTMENT' end as kind, -delta as delta, record_id, null::text as store_transaction_id, reason from usage_ledger where organization_id = $1
       union all
       select id, created_at, case kind when 'GRANT' then 'PREPAID_CREDIT' when 'REVOCATION' then 'REFUND_REVOCATION' when 'CONSUME' then 'USAGE' else 'ADJUSTMENT' end, delta, record_id, store_transaction_id, reason from credit_ledger where organization_id = $1
       order by created_at desc limit $2`,
      [orgId, limit],
    );
    return r.rows.map((x) => ({ id: x.id, at: x.created_at.toISOString(), kind: x.kind as LedgerEntry['kind'], delta: x.delta, recordId: x.record_id, storeTransactionId: x.store_transaction_id, reason: x.reason }));
  }

  /**
   * Server-side verification against RevenueCat. A client-reported purchase
   * grants nothing; only what RevenueCat returns is applied.
   */
  async reconcile(orgId: string, ownerId: string, appUserId: string): Promise<{ pendingVerification: boolean }> {
    if (appUserId !== revenueCatAppUserIdFor(orgId)) throw new ApiException('SUBSCRIPTION_OTHER_WORKSPACE', 'Purchase identity does not belong to this workspace');
    if (!this.env.REVENUECAT_SECRET_API_KEY) {
      throw new ApiException('PURCHASE_NOT_VERIFIED', 'Billing verification is not configured on this server (REVENUECAT_SECRET_API_KEY missing). No paid capacity was granted.');
    }
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${this.env.REVENUECAT_SECRET_API_KEY}`, Accept: 'application/json' },
    });
    if (!res.ok) throw new ApiException('PURCHASE_NOT_VERIFIED', `Store verification failed (${res.status})`);
    const data = (await res.json()) as RcSubscriber;
    return this.applySubscriber(orgId, ownerId, appUserId, data);
  }

  private async applySubscriber(orgId: string, ownerId: string | null, appUserId: string, data: RcSubscriber): Promise<{ pendingVerification: boolean }> {
    const subs = data.subscriber.subscriptions ?? {};
    const now = Date.now();
    // Pick the best active subscription product we know.
    let best: { plan: PlanCode; status: SubscriptionStatus; store: string; productId: string; start: string; end: string | null; originalTxn: string | null } | null = null;
    for (const [productId, s] of Object.entries(subs)) {
      const plan = this.planForProduct(productId);
      if (!plan) continue;
      const exp = s.expires_date ? new Date(s.expires_date).getTime() : null;
      let status: SubscriptionStatus = 'EXPIRED';
      if (s.refunded_at) status = 'REFUNDED';
      else if (exp === null || exp > now) status = s.billing_issues_detected_at ? 'BILLING_RETRY' : s.unsubscribe_detected_at ? 'CANCELLED' : 'ACTIVE';
      else if (s.billing_issues_detected_at && exp > now - 16 * 86400_000) status = 'GRACE_PERIOD';
      // CANCELLED but not yet expired still grants access until period end.
      const grants = status === 'ACTIVE' || status === 'GRACE_PERIOD' || status === 'BILLING_RETRY' || (status === 'CANCELLED' && exp !== null && exp > now);
      if (!grants) continue;
      const rank = plan === 'TEAM' ? 2 : 1;
      if (!best || rank > (best.plan === 'TEAM' ? 2 : 1)) {
        best = { plan, status: status === 'CANCELLED' ? 'ACTIVE' : status, store: mapStore(s.store), productId, start: s.purchase_date, end: s.expires_date, originalTxn: s.original_transaction_id ?? null };
      }
    }

    await this.db.tx(async (c) => {
      if (best) {
        // Prevent a store subscription from being restored into a second workspace.
        if (best.originalTxn) {
          const other = await c.query<{ organization_id: string }>(`select organization_id from subscriptions where store = $1 and original_transaction_id = $2 and organization_id <> $3`, [best.store, best.originalTxn, orgId]);
          if (other.rows[0]) throw new ApiException('SUBSCRIPTION_OTHER_WORKSPACE', 'This store subscription already belongs to another workspace');
        }
        await c.query(`update subscriptions set status = 'EXPIRED' where organization_id = $1 and status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY') and (store_product_id <> $2 or coalesce(original_transaction_id,'') <> coalesce($3,''))`, [orgId, best.productId, best.originalTxn]);
        const owner = ownerId ?? (await c.query<{ user_id: string }>(`select user_id from memberships where organization_id = $1 and role = 'OWNER' order by created_at limit 1`, [orgId])).rows[0]?.user_id;
        if (!owner) throw new ApiException('CONFLICT', 'Workspace has no owner');
        const existing = await c.query<{ id: string }>(`select id from subscriptions where organization_id = $1 and store_product_id = $2 and coalesce(original_transaction_id,'') = coalesce($3,'')`, [orgId, best.productId, best.originalTxn]);
        if (existing.rows[0]) {
          await c.query(`update subscriptions set status = $2, plan_code = $3, current_period_start = $4, current_period_end = $5, last_verified_at = now(), revenuecat_app_user_id = $6 where id = $1`, [existing.rows[0].id, best.status, best.plan, best.start, best.end, appUserId]);
        } else {
          await c.query(
            `insert into subscriptions (organization_id, billing_owner_user_id, revenuecat_app_user_id, plan_code, status, store, store_product_id, original_transaction_id, current_period_start, current_period_end, last_verified_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
            [orgId, owner, appUserId, best.plan, best.status, best.store, best.productId, best.originalTxn, best.start, best.end],
          );
        }
        await c.query(`update organizations set plan_code = $2 where id = $1 and plan_code <> $2`, [orgId, best.plan]);
      } else {
        const changed = await c.query(`update subscriptions set status = 'EXPIRED', last_verified_at = now() where organization_id = $1 and status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY') returning id`, [orgId]);
        // Downgrade to FREE; existing proof retention entitlements are untouched.
        await c.query(`update organizations set plan_code = 'FREE' where id = $1 and plan_code <> 'FREE'`, [orgId]);
        if (changed.rowCount) await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'SUBSCRIPTION_CHANGED', subjectType: 'organization', subjectId: orgId, after: { planCode: 'FREE' } }, c);
      }
      if (best) await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'SUBSCRIPTION_CHANGED', subjectType: 'organization', subjectId: orgId, after: { planCode: best.plan, status: best.status, store: best.store } }, c);

      // Consumables: prepaid packs keyed by verified store transaction id; refunds revoke once.
      const packs = data.subscriber.non_subscriptions?.[this.env.BILLING_PRODUCT_PACK_500] ?? [];
      for (const t of packs) {
        try {
          await c.query(`insert into credit_ledger (organization_id, kind, delta, store_transaction_id, reason) values ($1,'GRANT',$2,$3,'verified store purchase')`, [orgId, PREPAID_PACK.records, t.id]);
          await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'CREDIT_GRANTED', subjectType: 'organization', subjectId: orgId, after: { records: PREPAID_PACK.records, storeTransactionId: t.id } }, c);
        } catch (e) {
          if (!isUniqueViolation(e)) throw e; // already applied
        }
        if (t.refunded_at) {
          try {
            await c.query(`insert into credit_ledger (organization_id, kind, delta, store_transaction_id, reason) values ($1,'REVOCATION',$2,$3,'store refund')`, [orgId, -PREPAID_PACK.records, t.id]);
            await this.audit.record({ organizationId: orgId, actorUserId: ownerId, action: 'CREDIT_REVOKED', subjectType: 'organization', subjectId: orgId, after: { storeTransactionId: t.id } }, c);
          } catch (e) {
            if (!isUniqueViolation(e)) throw e;
          }
        }
      }
    });
    return { pendingVerification: false };
  }

  /**
   * RevenueCat webhook. Authenticated by the shared Authorization header,
   * idempotent by event id, and never trusted for entitlement details: the
   * event only triggers a fresh server-side reconciliation.
   */
  async webhook(authHeader: string | undefined, body: { event?: { id?: string; type?: string; app_user_id?: string; original_app_user_id?: string; store?: string; product_id?: string; transaction_id?: string; original_transaction_id?: string; event_timestamp_ms?: number } }): Promise<{ ok: true }> {
    if (!this.env.REVENUECAT_WEBHOOK_AUTH_HEADER || authHeader !== this.env.REVENUECAT_WEBHOOK_AUTH_HEADER) {
      throw new ApiException('WEBHOOK_UNAUTHORIZED', 'Invalid webhook authorization');
    }
    const ev = body.event;
    if (!ev?.id || !ev.type) throw new ApiException('VALIDATION_FAILED', 'Malformed webhook event');
    const appUserId = ev.app_user_id ?? ev.original_app_user_id ?? null;
    const orgId = appUserId?.startsWith('prw_') ? appUserId.slice(4) : null;
    const inserted = await this.db.query(
      `insert into billing_events (id, organization_id, revenuecat_app_user_id, event_type, store, product_id, transaction_id, original_transaction_id, event_at, payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,to_timestamp($9::double precision / 1000.0),$10) on conflict (id) do nothing returning id`,
      [ev.id, orgId, appUserId, ev.type, ev.store ?? null, ev.product_id ?? null, ev.transaction_id ?? null, ev.original_transaction_id ?? null, ev.event_timestamp_ms ?? Date.now(), JSON.stringify(body)],
    );
    if (!inserted.rowCount) return { ok: true }; // duplicate delivery
    if (orgId && appUserId) {
      try {
        const org = await this.db.one<{ id: string }>(`select id from organizations where id = $1`, [orgId]);
        if (org) await this.reconcileAsSystem(orgId, appUserId);
        await this.db.query(`update billing_events set processed_at = now() where id = $1`, [ev.id]);
      } catch (e) {
        await this.db.query(`update billing_events set processing_error = $2 where id = $1`, [ev.id, String((e as Error).message).slice(0, 300)]);
        this.logger.warn(`webhook ${ev.id} processing failed; will be retried by RECONCILE_ENTITLEMENT job`);
        await this.db.query(`insert into jobs (kind, dedupe_key, payload) values ('RECONCILE_ENTITLEMENT',$1,$2) on conflict (dedupe_key) where status = 'PENDING' and dedupe_key is not null do nothing`, [`entitlement:${orgId}`, JSON.stringify({ orgId, appUserId })]);
      }
    }
    return { ok: true };
  }

  /** Used by the webhook and the retry job: no acting user, verification still server-side. */
  async reconcileAsSystem(orgId: string, appUserId: string): Promise<{ pendingVerification: boolean }> {
    if (appUserId !== revenueCatAppUserIdFor(orgId)) throw new ApiException('SUBSCRIPTION_OTHER_WORKSPACE', 'Purchase identity does not belong to this workspace');
    if (!this.env.REVENUECAT_SECRET_API_KEY) throw new ApiException('PURCHASE_NOT_VERIFIED', 'REVENUECAT_SECRET_API_KEY missing');
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, { headers: { Authorization: `Bearer ${this.env.REVENUECAT_SECRET_API_KEY}`, Accept: 'application/json' } });
    if (!res.ok) throw new ApiException('PURCHASE_NOT_VERIFIED', `Store verification failed (${res.status})`);
    return this.applySubscriber(orgId, null, appUserId, (await res.json()) as RcSubscriber);
  }
}

function mapStore(store: string): string {
  const s = store.toLowerCase();
  if (s.includes('app_store') || s === 'mac_app_store') return 'APP_STORE';
  if (s.includes('play')) return 'PLAY_STORE';
  return s.toUpperCase();
}
