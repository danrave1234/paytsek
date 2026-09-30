import { PROVIDERS, type Provider } from '@paytsek/contracts';
import { PROVIDER_PACKAGES } from '@paytsek/receipt-parsers';

/**
 * Provider support shown on the marketing pages. A provider is eligible for
 * authoritative matching only when its Android package is allowlisted. Exact
 * reference capability is a separate, stricter registry concern.
 */
export interface ProviderSupport {
  provider: Provider;
  name: string;
  /** A recognized notification can be auto-matched when it is the sole safe candidate. */
  autoMatch: boolean;
  /** Short status for the compact strip under the hero. */
  short: string;
  /** Sentence for the support table. */
  note: string;
}

export const PROVIDER_SUPPORT: readonly ProviderSupport[] = PROVIDERS.map(({ value, label }) => {
  const autoMatch = PROVIDER_PACKAGES[value].length > 0;
  return {
    provider: value,
    name: label,
    autoMatch,
    short: autoMatch ? 'Automatic when unique' : 'Proof recording only',
    note: autoMatch
      ? 'A single recognized notification with the exact amount and a safe nearby time becomes a Strong match. Multiple or conflicting candidates stay Possible match.'
      : 'Payment proofs stay Recorded while notification evidence for this wallet is unavailable.',
  };
});
