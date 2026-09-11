import type { MatchReasonCode, PaymentRail, Provider, ReferenceNamespace, TimeBasis, TimePrecision } from '@paytsek/contracts';
import { MATCHING_CRITICAL_FIELDS } from '@paytsek/contracts';
import { autoMatchFlow, normalizeReference, referencesEqual } from '@paytsek/receipt-parsers';

/**
 * Matching policy v1 — correctness before automatic coverage.
 *
 * Automatic match requires ALL of:
 *   - same receiving source (guaranteed by the caller's query scope),
 *   - exact currency and amount received,
 *   - a reference on BOTH sides whose namespaces are registered as comparable
 *     for the receiving provider, with equal normalized values,
 *   - exactly one such event, not already linked to another record,
 *   - receipt status not FAILED/PENDING,
 *   - no matching-critical field edited by a user (edits go to review),
 *   - no owner-approval requirement for staff-created records.
 * Amount + time alone NEVER auto-confirms, even with a single candidate.
 */
export const MATCHER_VERSION = 'v1';

/**
 * Resolve the capability-registry flow for this record. The rail comes from
 * the customer's confirmation, not from the notification, so a QR payment is
 * never gated by a rule that was only tested for Express Send.
 */
function flowFor(record: MatchRecordInput, receiptNamespace: ReferenceNamespace, notificationNamespace: ReferenceNamespace) {
  return autoMatchFlow({
    receiptProvider: record.receiptProvider,
    receivingProvider: record.receivingProvider,
    rail: record.paymentRail,
    receiptNamespace,
    notificationNamespace,
  });
}

export interface MatchRecordInput {
  id: string;
  receivingProvider: Provider;
  /** Provider named on the customer's confirmation, when it could be read. */
  receiptProvider: Provider | null;
  /** Rail named on the customer's confirmation. The flow is keyed on it. */
  paymentRail: PaymentRail | null;
  currency: 'PHP';
  amountCentavos: number;
  referenceNamespace: ReferenceNamespace | null;
  referenceValue: string | null;
  receiptStatus: 'SUCCESS' | 'PENDING' | 'FAILED' | 'UNKNOWN';
  receiptTransactionAt: string | null;
  receiptTransactionPrecision: TimePrecision;
  capturedAt: string;
  editedFields: string[];
  /** True when the source requires owner approval and the creator is not an owner. */
  requiresOwnerApproval: boolean;
}

export interface MatchEventInput {
  id: string;
  currency: 'PHP';
  amountCentavos: number;
  referenceNamespace: ReferenceNamespace;
  referenceValue: string | null;
  /** Best available event time. */
  eventAt: string;
  eventTimeSource: 'PROVIDER_DESCRIBED' | 'NOTIFICATION_WHEN' | 'POSTED';
  linkedToOtherRecord: boolean;
}

export interface CandidateAssessment {
  event: MatchEventInput;
  deltaSeconds: number | null;
  supportingFields: string[];
  missingFields: string[];
  blockers: MatchReasonCode[];
}

export type MatchDecision =
  | {
      kind: 'AUTO';
      eventId: string;
      flowId: string;
      reasonCodes: MatchReasonCode[];
      supportingFields: string[];
      missingFields: string[];
      timeBasis: TimeBasis;
      windowSeconds: number;
      deltaSeconds: number | null;
    }
  | { kind: 'REVIEW'; reasonCodes: MatchReasonCode[]; candidates: CandidateAssessment[]; timeBasis: TimeBasis; windowSeconds: number }
  | { kind: 'NONE'; timeBasis: TimeBasis; windowSeconds: number };

export interface MatcherConfig {
  candidateWindowSeconds: number;
  captureTimeFallbackWindowSeconds: number;
}

function secondsBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

/** Choose the time basis: trustworthy receipt time first, capture time as weaker fallback. */
export function chooseTimeBasis(record: MatchRecordInput, cfg: MatcherConfig): { basis: TimeBasis; at: string | null; window: number } {
  const trustworthy = record.receiptTransactionAt && (record.receiptTransactionPrecision === 'SECOND' || record.receiptTransactionPrecision === 'MINUTE');
  if (trustworthy && record.receiptTransactionAt) {
    return { basis: 'RECEIPT_TRANSACTION_TIME', at: record.receiptTransactionAt, window: cfg.candidateWindowSeconds };
  }
  return { basis: 'CAPTURE_TIME', at: record.capturedAt, window: cfg.captureTimeFallbackWindowSeconds };
}

export function editedMatchingCriticalField(editedFields: string[]): boolean {
  return editedFields.some((f) => (MATCHING_CRITICAL_FIELDS as readonly string[]).includes(f));
}

export function assessCandidate(record: MatchRecordInput, event: MatchEventInput, basisAt: string | null): CandidateAssessment {
  const supporting: string[] = [];
  const missing: string[] = [];
  const blockers: MatchReasonCode[] = [];

  if (event.currency === record.currency && event.amountCentavos === record.amountCentavos) supporting.push('amount');
  else blockers.push('AMOUNT_MISMATCH');

  const recRef = record.referenceNamespace && record.referenceValue ? normalizeReference(record.referenceNamespace, record.referenceValue) : null;
  const evRef = event.referenceValue ? normalizeReference(event.referenceNamespace, event.referenceValue) : null;
  if (!recRef) missing.push('receipt.reference');
  if (!evRef) missing.push('notification.reference');
  if (recRef && evRef) {
    const cmp = flowFor(record, recRef.namespace, evRef.namespace);
    if (!cmp.comparable) blockers.push('NO_COMPARABLE_NAMESPACE');
    else if (referencesEqual(recRef, evRef)) supporting.push('reference');
    else blockers.push('CONTRADICTORY_DATA');
  } else {
    blockers.push('AMOUNT_ONLY_CANDIDATES');
  }
  if (event.linkedToOtherRecord) blockers.push('EVENT_ALREADY_LINKED');

  const deltaSeconds = basisAt ? secondsBetween(basisAt, event.eventAt) : null;
  return { event, deltaSeconds, supportingFields: supporting, missingFields: missing, blockers };
}

export function decide(record: MatchRecordInput, events: MatchEventInput[], cfg: MatcherConfig): MatchDecision {
  const { basis, at, window } = chooseTimeBasis(record, cfg);

  // Hard exclusions: only exact amount/currency events are ever candidates.
  const sameAmount = events.filter((e) => e.currency === record.currency && e.amountCentavos === record.amountCentavos);
  const assessed = sameAmount.map((e) => assessCandidate(record, e, at));

  // Exact-ID rule.
  const exact = assessed.filter((a) => a.supportingFields.includes('reference') && !a.event.linkedToOtherRecord);
  const receiptOk = record.receiptStatus !== 'FAILED' && record.receiptStatus !== 'PENDING';
  const edited = editedMatchingCriticalField(record.editedFields);

  if (exact.length === 1 && receiptOk && !edited && !record.requiresOwnerApproval) {
    const a = exact[0]!;
    const recRef = normalizeReference(record.referenceNamespace!, record.referenceValue!)!;
    const evRef = normalizeReference(a.event.referenceNamespace, a.event.referenceValue!)!;
    const flow = flowFor(record, recRef.namespace, evRef.namespace);
    const delayed = a.deltaSeconds !== null && Math.abs(a.deltaSeconds) > window;
    return {
      kind: 'AUTO',
      eventId: a.event.id,
      flowId: flow.flowId ?? 'unknown',
      reasonCodes: delayed ? ['EXACT_REFERENCE_AND_AMOUNT', 'DELAYED_EXACT_REFERENCE'] : ['EXACT_REFERENCE_AND_AMOUNT'],
      supportingFields: a.supportingFields,
      missingFields: a.missingFields,
      timeBasis: basis,
      windowSeconds: window,
      deltaSeconds: a.deltaSeconds,
    };
  }

  // Suggested matches: same amount within the window (plus any exact-ID hits regardless of window).
  const inWindow = assessed.filter((a) => a.deltaSeconds === null || Math.abs(a.deltaSeconds) <= window || a.supportingFields.includes('reference'));
  inWindow.sort((x, y) => Math.abs(x.deltaSeconds ?? 0) - Math.abs(y.deltaSeconds ?? 0));

  if (inWindow.length === 0) return { kind: 'NONE', timeBasis: basis, windowSeconds: window };

  const reasons = new Set<MatchReasonCode>();
  if (exact.length > 1) reasons.add('MULTIPLE_CANDIDATES');
  if (exact.length >= 1 && !receiptOk) reasons.add('CONTRADICTORY_DATA');
  if (exact.length >= 1 && edited) reasons.add('RECEIPT_EDITED_AFTER_MATCH');
  if (exact.length >= 1 && record.requiresOwnerApproval) reasons.add('USER_SELECTED_CANDIDATE');
  if (exact.length === 0) {
    if (inWindow.some((a) => a.blockers.includes('NO_COMPARABLE_NAMESPACE'))) reasons.add('NO_COMPARABLE_NAMESPACE');
    reasons.add('AMOUNT_ONLY_CANDIDATES');
    if (inWindow.length > 1) reasons.add('MULTIPLE_CANDIDATES');
  }
  return { kind: 'REVIEW', reasonCodes: [...reasons], candidates: inWindow, timeBasis: basis, windowSeconds: window };
}
