import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { BillingProduct, LedgerEntry, PlanCode, SubscriptionStatus, UsageSummary } from '@paytsek/contracts';
import { ApiException } from '../common/errors';
import { loadEnv } from '../config/env';
import { AuditService } from '../db/audit.service';
import { DbService, isUniqueViolation } from '../db/db.service';

type ProductKey = 'STARTER_30_DAYS' | 'BUSINESS_30_DAYS';
type CheckoutRow = { checkout_url: string; expires_at: Date };

@Injectable()
export class BillingService {
  private readonly env = loadEnv();
  private readonly logger = new Logger(BillingService.name);
  constructor(private readonly db: DbService, private readonly audit: AuditService) {}

  products(): BillingProduct[] {
    // Keep checkout unavailable even if an old mobile build still exposes a
    // purchase control. This is a server-side policy, not merely hidden UI.
    if (this.env.BETA_MODE) return [];
    return [
      { key: 'STARTER_30_DAYS', storeProductId: 'paytsek_starter_30_days', kind: 'SUBSCRIPTION', planCode: 'STARTER', records: 500, priceCentavos: 5900 },
      { key: 'BUSINESS_30_DAYS', storeProductId: 'paytsek_business_30_days', kind: 'SUBSCRIPTION', planCode: 'BUSINESS', records: 2000, priceCentavos: 14900 },
    ];
  }

  private product(key: ProductKey): BillingProduct {
    const product = this.products().find((p) => p.key === key);
    if (!product) throw new ApiException('VALIDATION_FAILED', 'Unknown billing product');
    return product;
  }

  async usage(orgId: string): Promise<UsageSummary> {
    await this.expireEndedAccess(orgId);
    const r = await this.db.one<{
      plan_code: PlanCode; status: SubscriptionStatus | null; store: string | null; period_start: Date; allowance: number; used: number; credits: number;
      scanner_devices: number; collector_devices: number; receiving_sources: number; members: number; scanners: number; collectors: number; sources: number; member_count: number;
    }>(`select o.plan_code, s.status, s.store, current_period_start(o.id) as period_start, p.monthly_record_allowance as allowance,
              monthly_used(o.id, current_period_start(o.id)) as used, prepaid_credits_remaining(o.id) as credits,
              p.scanner_devices, p.collector_devices, p.receiving_sources, p.members,
              (select count(*) from devices where organization_id = o.id and status <> 'REVOKED' and capability in ('SCANNER','BOTH'))::int as scanners,
              (select count(*) from devices where organization_id = o.id and status <> 'REVOKED' and capability in ('COLLECTOR','BOTH'))::int as collectors,
              (select count(*) from payment_sources where organization_id = o.id and deleted_at is null)::int as sources,
              (select count(*) from memberships where organization_id = o.id)::int as member_count
         from organizations o join plans p on p.code = o.plan_code
         left join subscriptions s on s.organization_id = o.id and s.status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY')
        where o.id = $1`, [orgId]);
    if (!r) throw new ApiException('NOT_FOUND', 'Workspace not found');
    const start = new Date(r.period_start); const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    const ratio = r.allowance > 0 ? r.used / r.allowance : 1;
    return {
      planCode: r.plan_code, subscriptionStatus: r.status ?? 'NONE',
      managementPlatform: r.store === 'APP_STORE' || r.store === 'PLAY_STORE' || r.store === 'PAYMONGO' ? r.store : null,
      periodStart: start.toISOString(), periodEnd: end.toISOString(), monthlyAllowance: r.allowance, monthlyUsed: r.used,
      prepaidCreditsRemaining: r.credits, warnLevelsCrossed: [0.8, 1].filter((t) => ratio >= t),
      limits: { scannerDevices: r.scanner_devices, collectorDevices: r.collector_devices, receivingSources: r.receiving_sources, members: r.members },
      usage: { scannerDevices: r.scanners, collectorDevices: r.collectors, receivingSources: r.sources, members: r.member_count },
    };
  }

  /** A paid pass never silently remains active after its verified end date. */
  async expireEndedAccess(orgId?: string): Promise<void> {
    await this.db.tx(async (c) => {
      const scope = orgId ? 'and organization_id = $1' : '';
      const args = orgId ? [orgId] : [];
      await c.query(`update subscriptions set status = 'EXPIRED' where status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY') and current_period_end <= now() ${scope}`, args);
      await c.query(`update organizations o set plan_code = 'FREE' where ${orgId ? 'o.id = $1 and ' : ''}not exists (select 1 from subscriptions s where s.organization_id = o.id and s.status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY') and s.current_period_end > now())`, args);
    });
  }

  async ledger(orgId: string, limit = 100): Promise<LedgerEntry[]> {
    const r = await this.db.query<{ id: string; created_at: Date; kind: string; delta: number; record_id: string | null; store_transaction_id: string | null; reason: string | null }>(
      `select id, created_at, case when kind = 'USAGE' then 'USAGE' when kind = 'ADJUSTMENT' then 'ADJUSTMENT' end as kind, -delta as delta, record_id, null::text as store_transaction_id, reason from usage_ledger where organization_id = $1
       union all select id, created_at, case kind when 'GRANT' then 'PREPAID_CREDIT' when 'REVOCATION' then 'REFUND_REVOCATION' when 'CONSUME' then 'USAGE' else 'ADJUSTMENT' end, delta, record_id, store_transaction_id, reason from credit_ledger where organization_id = $1
       order by created_at desc limit $2`, [orgId, limit]);
    return r.rows.map((x) => ({ id: x.id, at: x.created_at.toISOString(), kind: x.kind as LedgerEntry['kind'], delta: x.delta, recordId: x.record_id, storeTransactionId: x.store_transaction_id, reason: x.reason }));
  }

  /** Creates a hosted PayMongo checkout. Only the signed webhook can grant capacity. */
  async createCheckout(orgId: string, ownerId: string, key: ProductKey): Promise<{ checkoutUrl: string; expiresAt: string }> {
    if (this.env.BETA_MODE) throw new ApiException('PURCHASE_NOT_VERIFIED', 'PayTsek is currently in free beta. No payment is required.');
    if (!this.env.PAYMONGO_SECRET_KEY) throw new ApiException('PURCHASE_NOT_VERIFIED', 'Online billing is not configured yet. Please contact PayTsek support.');
    const product = this.product(key);
    // All owners in one workspace share a pending checkout per product. This
    // advisory lock closes the small race between the initial PENDING lookup
    // and creating a PayMongo session, including fast double-clicks/retries.
    // Do not retry this transaction automatically: an external checkout is
    // created inside it and retries must reuse the stored session instead.
    return this.db.tx(async (c) => {
      await c.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`paytsek-checkout:${orgId}:${key}`]);
      await c.query(`update billing_checkout_sessions set status = 'EXPIRED' where organization_id = $1 and product_key = $2 and status = 'PENDING' and expires_at <= now()`, [orgId, key]);
      const existing = await c.query<CheckoutRow>(`select checkout_url, expires_at from billing_checkout_sessions where organization_id = $1 and product_key = $2 and status = 'PENDING' and expires_at > now() order by created_at desc limit 1`, [orgId, key]);
      if (existing.rows[0]) return { checkoutUrl: existing.rows[0].checkout_url, expiresAt: existing.rows[0].expires_at.toISOString() };

      const checkoutId = randomUUID();
      const auth = `Basic ${Buffer.from(`${this.env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`;
      const dashboardUrl = new URL('/dashboard', this.env.PAYTSEK_WEB_URL).toString();
      const response = await fetch(`${this.env.PAYMONGO_API_URL}/v2/checkout_sessions`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json', 'Idempotency-Key': checkoutId },
        body: JSON.stringify({ data: { attributes: {
          line_items: [{ name: `PayTsek ${product.key.replace(/_/g, ' ')}`, amount: product.priceCentavos, currency: 'PHP', quantity: 1 }],
          // QRPh is the supported payment rail for PayTsek billing. PayMongo
          // requires an explicit list even when a single method is offered.
          payment_method_types: ['qrph'],
          description: `PayTsek ${product.key.replace(/_/g, ' ')}`,
          reference_number: checkoutId,
          success_url: `${dashboardUrl}?checkout=${checkoutId}`,
          cancel_url: `${dashboardUrl}?checkout=${checkoutId}&cancelled=1`,
          metadata: { paytsek_checkout_id: checkoutId, paytsek_organization_id: orgId, paytsek_product_key: key },
        } } }),
      });
      const payload = await response.json().catch(() => null) as { data?: { id?: string; attributes?: { checkout_url?: string } } } | null;
      const providerSessionId = payload?.data?.id; const checkoutUrl = payload?.data?.attributes?.checkout_url;
      if (!response.ok || !providerSessionId || !checkoutUrl) { this.logger.warn(`PayMongo checkout creation failed (${response.status})`); throw new ApiException('PURCHASE_NOT_VERIFIED', 'We could not start checkout. Please try again.'); }
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      try {
        await c.query(`insert into billing_checkout_sessions (id, organization_id, billing_owner_user_id, product_key, provider_link_id, checkout_url, status, expires_at) values ($1,$2,$3,$4,$5,$6,'PENDING',$7)`, [checkoutId, orgId, ownerId, key, providerSessionId, checkoutUrl, expiresAt]);
      } catch (e) {
        this.logger.error(`PayMongo checkout session ${providerSessionId} was created but could not be recorded`);
        throw e;
      }
      return { checkoutUrl, expiresAt: expiresAt.toISOString() };
    }, { retries: 0 });
  }

  async paymongoWebhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<{ ok: true }> {
    if (!rawBody || !this.verifySignature(rawBody, signature)) throw new ApiException('WEBHOOK_UNAUTHORIZED', 'Invalid PayMongo webhook signature');
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    const eventType = containsString(body, 'checkout_session.payment.paid') ? 'checkout_session.payment.paid' : containsString(body, 'link.payment.paid') ? 'link.payment.paid' : null;
    if (!eventType) return { ok: true };
    // Keep legacy Payment Link fulfillment during the rollout, while newly
    // created Hosted Checkout sessions supply a return URL to the dashboard.
    const providerSessionId = findPrefixedString(body, 'cs_') ?? findPrefixedString(body, 'link_');
    const eventId = findPrefixedString(body, 'evt_') ?? `paymongo:${createHmac('sha256', this.env.PAYMONGO_WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
    const paymentId = findPrefixedString(body, 'pay_');
    if (!providerSessionId) { this.logger.warn('PayMongo payment webhook omitted a checkout identifier'); return { ok: true }; }
    await this.db.tx(async (c) => {
      const inserted = await c.query(`insert into billing_events (id, provider, event_type, store, event_at, payload) values ($1,'PAYMONGO',$2,'PAYMONGO',now(),$3) on conflict (id) do nothing returning id`, [eventId, eventType, JSON.stringify(body)]);
      if (!inserted.rowCount) return;
      const checkout = await c.query<{ id: string; organization_id: string; billing_owner_user_id: string; product_key: ProductKey; status: string }>(`select id, organization_id, billing_owner_user_id, product_key, status from billing_checkout_sessions where provider_link_id = $1 for update`, [providerSessionId]);
      const row = checkout.rows[0];
      // A cancelled or expired checkout must never reactivate access. Return
      // 200 so PayMongo does not retry an event that was intentionally ignored.
      if (!row || row.status !== 'PENDING') return;
      await c.query(`update billing_checkout_sessions set status = 'PAID', provider_payment_id = $2, paid_at = now() where id = $1`, [row.id, paymentId]);
      await c.query(`update billing_events set organization_id = $2, processed_at = now() where id = $1`, [eventId, row.organization_id]);
      const product = this.product(row.product_key);
      if (product.kind === 'CONSUMABLE') {
        try { await c.query(`insert into credit_ledger (organization_id, kind, delta, store_transaction_id, reason) values ($1,'GRANT',$2,$3,'PayMongo verified payment')`, [row.organization_id, product.records, paymentId ?? providerSessionId]); }
        catch (e) { if (!isUniqueViolation(e)) throw e; }
        await this.audit.record({ organizationId: row.organization_id, actorUserId: row.billing_owner_user_id, action: 'CREDIT_GRANTED', subjectType: 'organization', subjectId: row.organization_id, after: { records: product.records, provider: 'PAYMONGO', paymentId: paymentId ?? providerSessionId } }, c);
      } else {
        // A customer may renew early. Preserve unused paid time instead of
        // replacing it with a new period that starts today.
        const current = await c.query<{ current_period_end: Date }>(`select current_period_end from subscriptions where organization_id = $1 and status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY') order by current_period_end desc limit 1 for update`, [row.organization_id]);
        const now = new Date();
        const currentEnd = current.rows[0]?.current_period_end;
        const start = currentEnd && currentEnd > now ? currentEnd : now;
        const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
        await c.query(`update subscriptions set status = 'EXPIRED' where organization_id = $1 and status in ('ACTIVE','GRACE_PERIOD','BILLING_RETRY')`, [row.organization_id]);
        await c.query(`insert into subscriptions (organization_id, billing_owner_user_id, plan_code, status, store, store_product_id, original_transaction_id, current_period_start, current_period_end, last_verified_at) values ($1,$2,$3,'ACTIVE','PAYMONGO',$4,$5,$6,$7,now())`, [row.organization_id, row.billing_owner_user_id, product.planCode, product.storeProductId, paymentId ?? providerSessionId, start, end]);
        await c.query(`update organizations set plan_code = $2 where id = $1`, [row.organization_id, product.planCode]);
        await this.audit.record({ organizationId: row.organization_id, actorUserId: row.billing_owner_user_id, action: 'SUBSCRIPTION_CHANGED', subjectType: 'organization', subjectId: row.organization_id, after: { planCode: product.planCode, status: 'ACTIVE', provider: 'PAYMONGO' } }, c);
      }
    });
    return { ok: true };
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!this.env.PAYMONGO_WEBHOOK_SECRET || !signature) return false;
    const fields = Object.fromEntries(signature.split(',').map((p) => p.trim().split('=', 2)).filter(([k, v]) => Boolean(k && v)));
    const timestamp = fields.t; const received = fields.li || fields.te;
    if (!timestamp || !received || !/^\d+$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60_000) return false;
    const expected = createHmac('sha256', this.env.PAYMONGO_WEBHOOK_SECRET).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
    const a = Buffer.from(expected, 'hex'); const b = Buffer.from(received, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

function containsString(value: unknown, target: string): boolean { return value === target || (Array.isArray(value) ? value.some((v) => containsString(v, target)) : !!value && typeof value === 'object' && Object.values(value as Record<string, unknown>).some((v) => containsString(v, target))); }
function findPrefixedString(value: unknown, prefix: string): string | null {
  if (typeof value === 'string' && value.startsWith(prefix)) return value;
  const values = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value as Record<string, unknown>) : [];
  for (const item of values) { const found = findPrefixedString(item, prefix); if (found) return found; }
  return null;
}
