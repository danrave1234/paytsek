import type { PlanCode } from './enums';

/**
 * Seed plan definitions. Prices are product hypotheses (see brief §13); the
 * storefront-provided localized price is what the app displays. Server-side
 * limits below are authoritative for quota and slot enforcement.
 */
export interface PlanLimits {
  code: PlanCode;
  displayName: string;
  /** Proposed PHP monthly price in centavos; informational only. */
  proposedMonthlyPriceCentavos: number;
  /** New canonical records that may be saved per billing month. */
  monthlyRecordAllowance: number;
  scannerDevices: number;
  collectorDevices: number;
  receivingSources: number;
  members: number;
  /** Retention entitlement stored on each proof image at creation. */
  proofImageRetentionDays: number;
}

export const PLAN_LIMITS: Record<PlanCode, PlanLimits> = {
  FREE: {
    code: 'FREE',
    displayName: 'Beta',
    proposedMonthlyPriceCentavos: 0,
    // Beta is deliberately generous while the product is being validated.
    // The database remains authoritative, but these defaults keep clients and
    // new environments aligned with the no-charge beta policy.
    monthlyRecordAllowance: 1_000_000,
    scannerDevices: 10,
    collectorDevices: 5,
    receivingSources: 5,
    members: 10,
    proofImageRetentionDays: 90,
  },
  STARTER: {
    code: 'STARTER',
    displayName: 'Starter',
    proposedMonthlyPriceCentavos: 5900,
    monthlyRecordAllowance: 500,
    scannerDevices: 2,
    collectorDevices: 1,
    receivingSources: 1,
    members: 2,
    proofImageRetentionDays: 90,
  },
  BUSINESS: {
    code: 'BUSINESS',
    displayName: 'Business',
    proposedMonthlyPriceCentavos: 14900,
    monthlyRecordAllowance: 2000,
    scannerDevices: 5,
    collectorDevices: 2,
    receivingSources: 2,
    members: 3,
    proofImageRetentionDays: 90,
  },
};

/** Warn thresholds as fractions of the monthly allowance. */
export const QUOTA_WARN_THRESHOLDS = [0.8, 1.0] as const;

/** Bounded local draft cap on scanners when quota is exhausted or offline. */
export const LOCAL_DRAFT_CAP = 25;
export const LOCAL_DRAFT_WARN_AT = 20;
