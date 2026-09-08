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
    displayName: 'Free',
    proposedMonthlyPriceCentavos: 0,
    monthlyRecordAllowance: 50,
    scannerDevices: 1,
    collectorDevices: 1,
    receivingSources: 1,
    members: 2,
    proofImageRetentionDays: 30,
  },
  SOLO: {
    code: 'SOLO',
    displayName: 'Solo',
    proposedMonthlyPriceCentavos: 14900,
    monthlyRecordAllowance: 1000,
    scannerDevices: 2,
    collectorDevices: 1,
    receivingSources: 1,
    members: 2,
    proofImageRetentionDays: 90,
  },
  TEAM: {
    code: 'TEAM',
    displayName: 'Team',
    proposedMonthlyPriceCentavos: 39900,
    monthlyRecordAllowance: 5000,
    scannerDevices: 5,
    collectorDevices: 2,
    receivingSources: 2,
    members: 5,
    proofImageRetentionDays: 90,
  },
};

/** Prepaid record pack. Purchased credits never expire (Apple guideline 3.1). */
export const PREPAID_PACK = {
  productKey: 'PACK_500',
  displayName: '500 record pack',
  proposedPriceCentavos: 9900,
  records: 500,
  /** Records created while any paid credit exists inherit the paid retention. */
  proofImageRetentionDays: 90,
} as const;

/** Warn thresholds as fractions of the monthly allowance. */
export const QUOTA_WARN_THRESHOLDS = [0.8, 1.0] as const;

/** Bounded local draft cap on scanners when quota is exhausted or offline. */
export const LOCAL_DRAFT_CAP = 25;
export const LOCAL_DRAFT_WARN_AT = 20;
