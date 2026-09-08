import { PROVIDERS, type Provider } from '@payrecord/contracts';
import { FLOW_REGISTRY, autoMatchFlowsForReceivingProvider } from '@payrecord/receipt-parsers';

/**
 * Provider support shown on the marketing pages, DERIVED from the capability
 * registry rather than retyped. If a flow is enabled in
 * packages/receipt-parsers/src/registry.ts the site starts saying so on the
 * next build; if it is disabled, the site cannot accidentally over-claim.
 */
export interface ProviderSupport {
  provider: Provider;
  name: string;
  /** Auto-matching is live for at least one flow into this receiving wallet. */
  autoMatch: boolean;
  /** Short status for the compact strip under the hero. */
  short: string;
  /** Sentence for the support table. Uses the registry's own disabled reason. */
  note: string;
}

/** The registry's reason for the first disabled flow into this wallet. */
function disabledReasonFor(provider: Provider): string | null {
  const flow = FLOW_REGISTRY.find((f) => f.receivingProvider === provider && !f.autoMatchEnabled && f.disabledReason);
  return flow?.disabledReason ?? null;
}

export const PROVIDER_SUPPORT: readonly ProviderSupport[] = PROVIDERS.map(({ value, label }) => {
  const flows = autoMatchFlowsForReceivingProvider(value);
  const autoMatch = flows.length > 0;
  return {
    provider: value,
    name: label,
    autoMatch,
    short: autoMatch ? 'Record + auto-match' : 'Record + manual confirm',
    note: autoMatch
      ? `Enabled for tested flows: ${flows.join(', ')}. Everything else goes to Review.`
      : disabledReasonFor(value) ??
        'Recording and manual confirmation only until real notification samples are verified.',
  };
});
