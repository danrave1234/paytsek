import { z } from 'zod';
import { PlanCode, SubscriptionStatus } from '../enums';
import { uuid } from './pairing';

export const UsageSummary = z.object({
  planCode: PlanCode,
  subscriptionStatus: SubscriptionStatus,
  /** Store that owns the active subscription, for management deep links. */
  managementPlatform: z.enum(['APP_STORE', 'PLAY_STORE']).nullable(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  monthlyAllowance: z.number().int(),
  monthlyUsed: z.number().int(),
  /** Purchased credits never expire. Consumed only after the monthly allowance. */
  prepaidCreditsRemaining: z.number().int(),
  /** Warn levels crossed for this period (0.8, 1.0). */
  warnLevelsCrossed: z.array(z.number()),
  limits: z.object({
    scannerDevices: z.number().int(),
    collectorDevices: z.number().int(),
    receivingSources: z.number().int(),
    members: z.number().int(),
  }),
  usage: z.object({
    scannerDevices: z.number().int(),
    collectorDevices: z.number().int(),
    receivingSources: z.number().int(),
    members: z.number().int(),
  }),
});
export type UsageSummary = z.infer<typeof UsageSummary>;

export const BillingProduct = z.object({
  /** Internal key, e.g. SOLO_MONTHLY, TEAM_MONTHLY, PACK_500 */
  key: z.string(),
  /** Store product identifier configured in RevenueCat. */
  storeProductId: z.string(),
  kind: z.enum(['SUBSCRIPTION', 'CONSUMABLE']),
  planCode: PlanCode.nullable(),
  records: z.number().int().nullable(),
  /** Localized price string must come from the storefront SDK; server returns null. */
  localizedPrice: z.null(),
});
export type BillingProduct = z.infer<typeof BillingProduct>;

/**
 * Client asks the server to reconcile entitlements for this workspace after a
 * purchase or restore. Server verifies with RevenueCat; a client-reported
 * success grants nothing by itself.
 */
export const ReconcilePurchaseRequest = z.object({
  /** RevenueCat app user id used by the SDK (server verifies it maps to the caller). */
  revenueCatAppUserId: z.string().max(200),
});

export const ReconcilePurchaseResponse = z.object({
  usage: UsageSummary,
  /** Whether a pending store transaction is still unverified (no capacity granted yet). */
  pendingVerification: z.boolean(),
});

/** Ledger row visible to the owner. */
export const LedgerEntry = z.object({
  id: uuid,
  at: z.string().datetime(),
  kind: z.enum(['MONTHLY_ALLOWANCE', 'PREPAID_CREDIT', 'USAGE', 'ADJUSTMENT', 'REFUND_REVOCATION']),
  delta: z.number().int(),
  recordId: uuid.nullable(),
  storeTransactionId: z.string().nullable(),
  reason: z.string().nullable(),
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;
