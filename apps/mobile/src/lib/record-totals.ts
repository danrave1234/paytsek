import type { HomeSummary, RecordSummary } from '@paytsek/contracts';
import type { Draft } from './drafts';
import { draftOccurredAt, recordOccurredAt } from './feed';
import { getFormatter } from './format';

export function workspaceDay(iso: string, timezone: string): string {
  return getFormatter('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function workspaceHour(iso: string, timezone: string): number {
  const hour = Number(getFormatter('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(iso)));
  return hour === 24 ? 0 : hour;
}
export function emptyToday(): HomeSummary['today'] {
  return { recordedCount: 0, recordedCentavos: 0, notificationMatchedCount: 0, notificationMatchedCentavos: 0,
    confirmedManuallyCount: 0, confirmedManuallyCentavos: 0, unverifiedCount: 0, unverifiedCentavos: 0,
    reviewRequiredCount: 0, reviewRequiredCentavos: 0, hourlyRecordedCentavos: Array.from({ length: 24 }, () => 0) };
}
export function unacknowledgedDrafts(drafts: Draft[], home?: HomeSummary): Draft[] {
  const acknowledged = new Set([...(home?.acknowledgedClientRecordIds ?? []), ...(home?.recentRecords.map((record) => record.clientRecordId) ?? [])]);
  return drafts.filter((draft) => draft.syncStatus !== 'SYNCED' && !acknowledged.has(draft.clientRecordId));
}
/** The same day and acknowledgment rules drive the headline, chart and day-close. */
export function todayWithPending(home: HomeSummary | undefined, drafts: Draft[], timezone: string, now = new Date().toISOString()): HomeSummary['today'] {
  const day = workspaceDay(now, timezone);
  const server = home?.workspaceLocalDate === day ? home.today : emptyToday();
  const today = { ...server, hourlyRecordedCentavos: [...server.hourlyRecordedCentavos] };
  for (const draft of unacknowledgedDrafts(drafts, home)) {
    const at = draftOccurredAt(draft);
    if (workspaceDay(at, timezone) !== day) continue;
    const cents = draft.request.corrected.amountCentavos;
    today.recordedCentavos += cents;
    today.recordedCount += 1;
    today.unverifiedCentavos += cents;
    today.unverifiedCount += 1;
    const hour = workspaceHour(at, timezone);
    today.hourlyRecordedCentavos[hour] = (today.hourlyRecordedCentavos[hour] ?? 0) + cents;
  }
  return today;
}

/** Merge a server acknowledgement once, without moving a historic payment into Today. */
export function mergeSyncedRecord(home: HomeSummary, record: RecordSummary, timezone: string): HomeSummary {
  const known = home.recentRecords.some((item) => item.id === record.id) || home.acknowledgedClientRecordIds.includes(record.clientRecordId);
  const next = { ...home,
    acknowledgedClientRecordIds: [...new Set([...home.acknowledgedClientRecordIds, record.clientRecordId])],
    recentRecords: [record, ...home.recentRecords.filter((item) => item.id !== record.id)]
      .sort((a, b) => Date.parse(recordOccurredAt(b)) - Date.parse(recordOccurredAt(a))).slice(0, 6),
    today: { ...home.today, hourlyRecordedCentavos: [...home.today.hourlyRecordedCentavos] },
  };
  if (known || record.evidenceState === 'VOIDED' || home.workspaceTimezone !== timezone || workspaceDay(recordOccurredAt(record), timezone) !== home.workspaceLocalDate) return next;
  const cents = record.amountCentavos;
  next.today.recordedCount += 1;
  next.today.recordedCentavos += cents;
  const hour = workspaceHour(recordOccurredAt(record), timezone);
  next.today.hourlyRecordedCentavos[hour] = (next.today.hourlyRecordedCentavos[hour] ?? 0) + cents;
  if (record.evidenceState === 'MATCHED_AUTO' || record.evidenceState === 'MATCHED_BY_USER') { next.today.notificationMatchedCount += 1; next.today.notificationMatchedCentavos += cents; }
  else if (record.evidenceState === 'CONFIRMED_MANUALLY') { next.today.confirmedManuallyCount += 1; next.today.confirmedManuallyCentavos += cents; }
  else if (record.evidenceState === 'REVIEW_REQUIRED') { next.today.reviewRequiredCount += 1; next.today.reviewRequiredCentavos += cents; }
  else { next.today.unverifiedCount += 1; next.today.unverifiedCentavos += cents; }
  return next;
}
