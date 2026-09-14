import { PROVIDER_LABELS, type Provider, type RecordSummary } from '@paytsek/contracts';
import type { Draft } from './drafts';

/** Wallet label read from the proof; unknown wallets fall back to the neutral label. */
export const providerLabel = (provider: Provider | null | undefined): string =>
  provider ? PROVIDER_LABELS[provider] : 'Unknown wallet';

/** When a local draft occurred: receipt time, then capture time, then creation time. */
export const draftOccurredAt = (draft: Draft): string =>
  draft.request.corrected.receiptTransactionAt ?? draft.request.capturedAt ?? draft.createdAt;

/** When a server record occurred: receipt time, then capture time, then creation time. */
export const recordOccurredAt = (record: RecordSummary): string =>
  record.receiptTransactionAt ?? record.capturedAt ?? record.createdAt;
