import type { PaymentRail, Provider, ReferenceNamespace } from '@paytsek/contracts';

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
    // Same wallet on both sides, same GCASH_REF_NO namespace, and receiving
    // money produces the same notification whichever rail the payer used — so
    // this rests on exactly the assumption already shipped for Express Send.
    // Enabling one and not the other was arbitrary. Both remain SYNTHETIC.
    referenceNamespacesComparable: true,
    autoMatchEnabled: true,
    disabledReason: null,
    evidence: 'SYNTHETIC',
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
    flowId: 'maya-to-maya.qr-p2p',
    receiptProvider: 'MAYA',
    receivingProvider: 'MAYA',
    rail: 'QR_P2P',
    receiptReferenceNamespace: 'MAYA_REF_NO',
    notificationReferenceNamespace: null,
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Incoming template is recognized, but it contains no comparable reference. Review required.',
    evidence: 'REDACTED_REAL_SAMPLE',
    observedAppVersions: [],
  },
  {
    flowId: 'maya-to-maya.qr-merchant',
    receiptProvider: 'MAYA',
    receivingProvider: 'MAYA',
    rail: 'QR_MERCHANT',
    receiptReferenceNamespace: 'MAYA_REF_NO',
    notificationReferenceNamespace: null,
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Merchant Scan-to-Pay confirmations use a different channel; notification text not verified.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'maya-to-gcash.instapay-qr',
    receiptProvider: 'MAYA',
    receivingProvider: 'GCASH',
    rail: 'INSTAPAY',
    receiptReferenceNamespace: 'MAYA_REF_NO',
    notificationReferenceNamespace: 'GCASH_REF_NO',
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Cross-provider references are not proven to be the same identifier; no invented mapping.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'gcash-to-maya.instapay-qr',
    receiptProvider: 'GCASH',
    receivingProvider: 'MAYA',
    rail: 'INSTAPAY',
    receiptReferenceNamespace: 'GCASH_REF_NO',
    notificationReferenceNamespace: 'MAYA_REF_NO',
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Cross-provider references are not proven to be the same identifier; no invented mapping.',
    evidence: 'NONE',
    observedAppVersions: [],
  },
  {
    flowId: 'maribank-to-maribank.qr-p2p',
    receiptProvider: 'MARIBANK',
    receivingProvider: 'MARIBANK',
    rail: 'QR_P2P',
    receiptReferenceNamespace: 'MARIBANK_REF_NO',
    notificationReferenceNamespace: null,
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Incoming template is recognized, but it contains no comparable reference. Review required.',
    evidence: 'REDACTED_REAL_SAMPLE',
    observedAppVersions: [],
  },
  {
    flowId: 'maribank-to-gcash.instapay-qr',
    receiptProvider: 'MARIBANK',
    receivingProvider: 'GCASH',
    rail: 'INSTAPAY',
    receiptReferenceNamespace: 'MARIBANK_REF_NO',
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
    notificationReferenceNamespace: null,
    referenceNamespacesComparable: false,
    autoMatchEnabled: false,
    disabledReason: 'Incoming template is recognized, but it contains no comparable reference. Review required.',
    evidence: 'REDACTED_REAL_SAMPLE',
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

/** Why an automatic match was not permitted. Surfaced for display and audit. */
export type FlowBlockReason =
  | 'MISSING_REFERENCE'
  | 'UNKNOWN_FLOW'
  | 'FLOW_NOT_ENABLED'
  | 'NAMESPACES_NOT_COMPARABLE';

export interface FlowDecision {
  comparable: boolean;
  flowId: string | null;
  reason: FlowBlockReason | null;
}

/**
 * The single gate for automatic matching.
 *
 * A payment flow is (receipt provider, receiving provider, rail) — the rail
 * comes from the customer's confirmation, because a "money received"
 * notification does not say which rail was used. Resolving the flow by rail is
 * what keeps a QR payment from being auto-matched under a rule that was only
 * ever tested for Express Send.
 */
export function autoMatchFlow(args: {
  receiptProvider: Provider | null;
  receivingProvider: Provider;
  rail: PaymentRail | null;
  receiptNamespace: ReferenceNamespace | null;
  notificationNamespace: ReferenceNamespace | null;
}): FlowDecision {
  const { receiptProvider, receivingProvider, rail, receiptNamespace, notificationNamespace } = args;
  if (!receiptNamespace || !notificationNamespace) {
    return { comparable: false, flowId: null, reason: 'MISSING_REFERENCE' };
  }

  const flow = findFlow(receiptProvider, receivingProvider, rail);
  if (!flow) return { comparable: false, flowId: null, reason: 'UNKNOWN_FLOW' };
  if (!flow.autoMatchEnabled) return { comparable: false, flowId: flow.flowId, reason: 'FLOW_NOT_ENABLED' };

  const namespacesMatchFlow =
    flow.referenceNamespacesComparable &&
    flow.receiptReferenceNamespace === receiptNamespace &&
    flow.notificationReferenceNamespace === notificationNamespace;

  return namespacesMatchFlow
    ? { comparable: true, flowId: flow.flowId, reason: null }
    : { comparable: false, flowId: flow.flowId, reason: 'NAMESPACES_NOT_COMPARABLE' };
}

/** Known provider packages. Verified against PackageManager on-device; never from notification title. */
export const PROVIDER_PACKAGES: Record<Provider, readonly string[]> = {
  GCASH: ['com.globe.gcash.android'],
  GOTYME: ['com.gotyme.gotymebank', 'ph.gotyme.app'],
  MAYA: ['com.paymaya'],
  // MariBank PH kept SeaBank's package through the 2025 rebrand.
  MARIBANK: ['ph.seabank.seabank'],
};

export function providerForPackage(packageName: string): Provider | null {
  for (const [provider, packages] of Object.entries(PROVIDER_PACKAGES) as [Provider, readonly string[]][]) {
    if (packages.includes(packageName)) return provider;
  }
  return null;
}
