import { z } from 'zod';
import { PlanCode, SubscriptionStatus } from '../enums';
import { uuid } from './pairing';

export const UsageSummary = z.object({
  planCode: PlanCode,
  subscriptionStatus: SubscriptionStatus,
  /** Billing system that owns the active plan. */
  managementPlatform: z.enum(['APP_STORE', 'PLAY_STORE', 'PAYMONGO']).nullable(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  monthlyAllowance: z.number().int(),
  monthlyUsed: z.number().int(),
  /** Legacy prepaid balance. It remains usable for existing customers but is not sold. */
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
  /** Internal checkout key, e.g. STARTER_30_DAYS or BUSINESS_30_DAYS. */
  key: z.string(),
  /** Stable product key, used for checkout and reconciliation. */
  storeProductId: z.string(),
  kind: z.enum(['SUBSCRIPTION', 'CONSUMABLE']),
  planCode: PlanCode.nullable(),
  records: z.number().int().nullable(),
  /** Price in PHP centavos; checkout is hosted by PayMongo. */
  priceCentavos: z.number().int().nonnegative(),
});
export type BillingProduct = z.infer<typeof BillingProduct>;

export const CreateCheckoutRequest = z.object({
  productKey: z.enum(['STARTER_30_DAYS', 'BUSINESS_30_DAYS']),
});
export type CreateCheckoutRequest = z.infer<typeof CreateCheckoutRequest>;

export const CheckoutSession = z.object({
  checkoutUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type CheckoutSession = z.infer<typeof CheckoutSession>;

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
