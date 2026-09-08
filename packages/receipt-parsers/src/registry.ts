import type { PaymentRail, Provider, ReferenceNamespace } from '@payrecord/contracts';

export const REGISTRY_VERSION = '1';

export type FixtureProvenance = 'SYNTHETIC' | 'REDACTED_REAL_SAMPLE';

/**
 * A payment flow is (receipt provider, receiving provider, rail). Automatic
 * matching is enabled per *tested* flow, not per brand.
 */
export interface FlowCapability {
  flowId: string;
  receiptProvider: Provider;
  receivingProvider: Provider;
  rail: PaymentRail;
  /** Namespace of the reference printed on the buyer's receipt. */
  receiptReferenceNamespace: ReferenceNamespace;
  /** Namespace of the reference contained in the seller's notification, if any. */
  notificationReferenceNamespace: ReferenceNamespace | null;
  /**
   * True only when real samples proved the receipt reference and the
   * notification reference are the same identifier. If false, the flow is
   * recording + manual confirmation only.
   */
  referenceNamespacesComparable: boolean;
  autoMatchEnabled: boolean;
  /** Human-readable reason shown in Settings > Sources when auto-match is off. */
  disabledReason: string | null;
  /** Provenance of the evidence backing this entry. */
  evidence: FixtureProvenance | 'NONE';
  observedAppVersions: string[];
}

/**
 * Launch registry. Every flow below defaults to *disabled* until a redacted real
 * sample pair (receipt + notification) has been captured and the parity tests
 * pass. Flip `autoMatchEnabled` only together with fixtures under
 * tests/fixtures/<flowId>/ and a note in docs/provider-support-matrix.md.
 */
export const FLOW_REGISTRY: readonly FlowCapability[] = [
  {
    flowId: 'gcash-to-gcash.express-send',
    receiptProvider: 'GCASH',
    receivingProvider: 'GCASH',
    rail: 'EXPRESS_SEND',
    receiptReferenceNamespace: 'GCASH_REF_NO',
    notificationReferenceNamespace: 'GCASH_REF_NO',
    // The user-observed sample shows amount / masked sender / phone in the
    // notification. Whether the Ref No. also appears is NOT yet proven, so the
    // namespaces are marked comparable (same provider, same field name) but the
    // adapter only emits a reference when it is literally present.
    referenceNamespacesComparable: true,
    autoMatchEnabled: true,
    disabledReason: null,
    evidence: 'SYNTHETIC',
    observedAppVersions: [],
  },
  {
    flowId: 'gcash-to-gcash.qr-p2p',
    receiptProvider: 'GCASH',
    receivingProvider: 'GCASH',
    rail: 'QR_P2P',
    receiptReferenceNamespace: 'GCASH_REF_NO',
    notificationReferenceNamespace: 'GCASH_REF_NO',
    referenceNamespacesComparable: true,
    autoMatchEnabled: false,
    disabledReason: 'No real QR-to-personal-account notification sample captured yet; recording and manual confirmation only.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'gcash-to-gcash.qr-merchant',
    receiptProvider: 'GCASH',
    receivingProvider: 'GCASH',
    rail: 'QR_MERCHANT',
    receiptReferenceNamespace: 'GCASH_REF_NO',
    notificationReferenceNamespace: null,
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Merchant Scan-to-Pay confirmations use a different channel; notification text not verified.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'gotyme-to-gcash.instapay-qr',
    receiptProvider: 'GOTYME',
    receivingProvider: 'GCASH',
    rail: 'INSTAPAY',
    receiptReferenceNamespace: 'GOTYME_REF_NO',
    notificationReferenceNamespace: 'GCASH_REF_NO',
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Cross-provider references are not proven to be the same identifier; no invented mapping.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'gotyme-to-gotyme.transfer',
    receiptProvider: 'GOTYME',
    receivingProvider: 'GOTYME',
    rail: 'BANK_TRANSFER',
    receiptReferenceNamespace: 'GOTYME_REF_NO',
    notificationReferenceNamespace: 'GOTYME_REF_NO',
    referenceNamespacesComparable: true,
    autoMatchEnabled: false,
    disabledReason: 'No GoTyme incoming-payment notification sample available; recording and manual confirmation only.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
];

export function findFlow(receiptProvider: Provider | null, receivingProvider: Provider, rail: PaymentRail | null): FlowCapability | null {
  if (!receiptProvider || !rail) return null;
  return (
    FLOW_REGISTRY.find(
      (f) => f.receiptProvider === receiptProvider && f.receivingProvider === receivingProvider && f.rail === rail,
    ) ?? null
  );
}

/** Flows for which a receiving source of this provider can auto-match. */
export function autoMatchFlowsForReceivingProvider(receivingProvider: Provider): string[] {
  return FLOW_REGISTRY.filter((f) => f.receivingProvider === receivingProvider && f.autoMatchEnabled).map(
    (f) => f.flowId,
  );
}

/**
 * Decide whether a receipt reference namespace and a notification reference
 * namespace are comparable for an automatic exact-ID match.
 */
export function namespacesComparable(
  receiptNamespace: ReferenceNamespace | null,
  notificationNamespace: ReferenceNamespace | null,
  receivingProvider: Provider,
): { comparable: boolean; flowId: string | null } {
  if (!receiptNamespace || !notificationNamespace) return { comparable: false, flowId: null };
  const flow = FLOW_REGISTRY.find(
    (f) =>
      f.receivingProvider === receivingProvider &&
      f.receiptReferenceNamespace === receiptNamespace &&
      f.notificationReferenceNamespace === notificationNamespace &&
      f.referenceNamespacesComparable &&
      f.autoMatchEnabled,
  );
  return flow ? { comparable: true, flowId: flow.flowId } : { comparable: false, flowId: null };
}

/** Known provider packages. Verified against PackageManager on-device; never from notification title. */
export const PROVIDER_PACKAGES: Record<Provider, readonly string[]> = {
  GCASH: ['com.globe.gcash.android'],
  GOTYME: ['com.gotyme.gotymebank', 'ph.gotyme.app'],
};

export function providerForPackage(packageName: string): Provider | null {
  for (const [provider, packages] of Object.entries(PROVIDER_PACKAGES) as [Provider, readonly string[]][]) {
    if (packages.includes(packageName)) return provider;
  }
  return null;
}
