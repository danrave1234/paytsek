import type { MatchReasonCode, Provider } from '@paytsek/contracts';
import { decide, type CandidateAssessment, type MatchDecision, type MatchEventInput, type MatchRecordInput, type MatcherConfig } from './matcher';

type UnscopedRecord = Omit<MatchRecordInput, 'receivingProvider'>;
type ProviderEvent = { provider: Provider; event: MatchEventInput };

/**
 * Evaluate a proof captured before a receiving wallet was known. Candidates
 * may come from any listener in the workspace, but source ambiguity forces a
 * human choice and therefore can never return AUTO.
 */
export function decideUnscoped(record: UnscopedRecord, events: ProviderEvent[], config: MatcherConfig): MatchDecision {
  const groups = new Map<Provider, MatchEventInput[]>();
  for (const item of events) groups.set(item.provider, [...(groups.get(item.provider) ?? []), item.event]);

  const candidates: CandidateAssessment[] = [];
  const reasons = new Set<MatchReasonCode>();
  let timeBasis: Extract<MatchDecision, { kind: 'NONE' }>['timeBasis'] = 'NONE';
  let windowSeconds = 0;

  for (const [receivingProvider, providerEvents] of groups) {
    const result = decide({ ...record, receivingProvider, requiresOwnerApproval: true }, providerEvents, config);
    timeBasis = result.timeBasis;
    windowSeconds = result.windowSeconds;
    if (result.kind === 'REVIEW') {
      candidates.push(...result.candidates);
      result.reasonCodes.forEach((reason) => reasons.add(reason));
    }
  }

  candidates.sort((a, b) => Math.abs(a.deltaSeconds ?? 0) - Math.abs(b.deltaSeconds ?? 0));
  if (candidates.length === 0) {
    const fallback = decide({ ...record, receivingProvider: record.receiptProvider ?? 'GCASH', requiresOwnerApproval: true }, [], config);
    return { kind: 'NONE', timeBasis: fallback.timeBasis, windowSeconds: fallback.windowSeconds };
  }
  if (candidates.length > 1) reasons.add('MULTIPLE_CANDIDATES');
  return { kind: 'REVIEW', reasonCodes: [...reasons], candidates, timeBasis, windowSeconds };
}
