import { extractReceiptFields } from '@paytsek/receipt-parsers';
import type { HomeSummary, RecordSummary } from '@paytsek/contracts';
import type { Draft } from './drafts';

/** Generated fixtures only. No payer data, wallet messages, proof files or credentials. */
export const TEST_USER = '11111111-1111-4111-8111-111111111111';
export const TEST_WORKSPACE = '22222222-2222-4222-8222-222222222222';
export const TEST_CLIENT = '33333333-3333-4333-8333-333333333333';
export function draftFixture(patch: Partial<Draft> = {}): Draft {
  const extracted = extractReceiptFields('Amount PHP 100.00').fields;
  return {
    clientRecordId: TEST_CLIENT, userId: TEST_USER, workspaceId: TEST_WORKSPACE, imageUri: 'file:///synthetic-proof.jpg', contentType: 'image/jpeg',
    syncStatus: 'LOCAL_DRAFT', proofId: null, lastError: null, quotaBlocked: false, serverRecordId: null,
    createdAt: '2026-10-04T02:00:00.000Z', updatedAt: '2026-10-04T02:00:00.000Z',
    request: { clientRecordId: TEST_CLIENT, sourceId: null, proofId: null, captureOrigin: 'CAMERA', capturedAt: '2026-10-04T02:00:00.000Z',
      appVersion: 'test', receiptParserId: null, receiptParserVersion: null, ocr: null, extracted,
      corrected: { ...extracted, currency: 'PHP', amountCentavos: 10000 }, editedFields: [] },
    ...patch,
  };
}
export function recordFixture(patch: Partial<RecordSummary> = {}): RecordSummary {
  return {
    id: '44444444-4444-4444-8444-444444444444', clientRecordId: TEST_CLIENT, sourceId: null, sourceLabel: 'Unknown wallet',
    organizationId: TEST_WORKSPACE, amountCentavos: 10000, currency: 'PHP', receiptProvider: null, evidenceState: 'UNVERIFIED',
    syncStatus: 'SYNCED', receiptTransactionAt: null, flags: [], referenceNamespace: null, referenceValue: null,
    payerName: null, customerLabel: null, note: null, createdByUserId: TEST_USER, createdByDisplayName: 'Synthetic staff',
    hasProofImage: true, linkedEventId: null, candidateCount: 0,
    capturedAt: '2026-10-04T02:00:00.000Z', createdAt: '2026-10-04T02:00:00.000Z',
    ...patch,
  };
}
export function homeFixture(): HomeSummary {
  return {
    workspaceLocalDate: '2026-10-04', workspaceTimezone: 'Asia/Manila', asOf: '2026-10-04T02:00:00.000Z', acknowledgedClientRecordIds: [],
    today: { recordedCount: 0, recordedCentavos: 0, notificationMatchedCount: 0, notificationMatchedCentavos: 0,
      confirmedManuallyCount: 0, confirmedManuallyCentavos: 0, unverifiedCount: 0, unverifiedCentavos: 0,
      reviewRequiredCount: 0, reviewRequiredCentavos: 0, hourlyRecordedCentavos: Array.from({ length: 24 }, () => 0) },
    collectors: [], recentRecords: [],
  };
}
