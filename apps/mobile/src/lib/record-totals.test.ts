import { describe, expect, it } from 'vitest';
import { mergeSyncedRecord, todayWithPending, workspaceDay } from './record-totals';
import { draftFixture, homeFixture, recordFixture } from './test-fixtures';

describe('workspace day and durable record handoff', () => {
  const now = '2026-10-04T02:00:00.000Z';
  it('groups Manila midnight independently of the device timezone', () => {
    expect(workspaceDay('2026-10-03T15:59:59Z', 'Asia/Manila')).toBe('2026-10-03');
    expect(workspaceDay('2026-10-03T16:00:00Z', 'Asia/Manila')).toBe('2026-10-04');
  });
  it('excludes yesterday pending proof from headline, chart and day-close', () => {
    const old = draftFixture();
    old.request.corrected.receiptTransactionAt = '2026-10-03T15:59:59Z';
    const today = todayWithPending(homeFixture(), [old, draftFixture({ clientRecordId: 'second' })], 'Asia/Manila', now);
    expect(today.recordedCentavos).toBe(10000);
    expect(today.unverifiedCentavos).toBe(10000);
    expect(today.recordedCount).toBe(1);
    expect(today.hourlyRecordedCentavos.reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it('deduplicates a server-acknowledged pending proof beyond the recent feed', () => {
    const home = homeFixture();
    const draft = draftFixture();
    home.acknowledgedClientRecordIds = [draft.clientRecordId];
    home.today.recordedCentavos = 10000;
    home.today.recordedCount = 1;
    expect(todayWithPending(home, [draft], 'Asia/Manila', now).recordedCentavos).toBe(10000);
    expect(mergeSyncedRecord(home, recordFixture(), 'Asia/Manila').today.recordedCount).toBe(1);
  });
  it('never puts a late-synced historic payment into Today', () => {
    const record = recordFixture({ receiptTransactionAt: '2026-10-03T05:00:00Z' });
    expect(mergeSyncedRecord(homeFixture(), record, 'Asia/Manila').today.recordedCount).toBe(0);
  });
  it('increments correct evidence amount exactly once', () => {
    const record = recordFixture({ evidenceState: 'REVIEW_REQUIRED' });
    const once = mergeSyncedRecord(homeFixture(), record, 'Asia/Manila');
    const twice = mergeSyncedRecord(once, record, 'Asia/Manila');
    expect(twice.today.reviewRequiredCentavos).toBe(10000);
    expect(twice.today.recordedCount).toBe(1);
  });
  it('does not reuse yesterday server totals after an offline midnight rollover', () => {
    const home = homeFixture();
    home.workspaceLocalDate = '2026-10-03';
    home.today.recordedCentavos = 50000;
    expect(todayWithPending(home, [draftFixture()], 'Asia/Manila', now).recordedCentavos).toBe(10000);
  });
});
