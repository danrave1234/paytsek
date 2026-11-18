import type { AnalyticsRange, AnalyticsSummary } from '@paytsek/contracts';
import { getFormatter } from './format';

/**
 * Chart buckets for recorded amounts over time. Only recorded amount and
 * count are grouped here; nothing about payers or products is inferred.
 */
export type RhythmBar = { label: string; centavos: number; count: number | null };

/** "12 AM", "2 PM" — hours in [0, 24]. */
export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** Twelve two-hour buckets from 24 hourly totals (workspace-local hours). */
export function hourlyBuckets(hourly: readonly number[]): RhythmBar[] {
  return Array.from({ length: 12 }, (_, index) => ({
    label: `${hourLabel(index * 2)} – ${hourLabel(index * 2 + 2)}`,
    centavos: (hourly[index * 2] ?? 0) + (hourly[index * 2 + 1] ?? 0),
    count: null,
  }));
}

/** API dates are workspace-local calendar days; format them without shifting zones. */
function calendarDay(date: string, options: Intl.DateTimeFormatOptions): string {
  return getFormatter('en-PH', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

/** "Oct 14" for an API calendar date. */
export function shortDay(date: string): string {
  return calendarDay(date, { month: 'short', day: 'numeric' });
}

/** Daily bars for 7/30 days; 90 days is grouped into weeks so bars stay tappable. */
export function dailyBuckets(daily: AnalyticsSummary['daily'], range: AnalyticsRange): RhythmBar[] {
  if (range !== '90D') {
    return daily.map((day) => ({
      label: calendarDay(day.date, { weekday: 'short', month: 'short', day: 'numeric' }),
      centavos: day.recordedCentavos,
      count: day.recordedCount,
    }));
  }
  const weeks: RhythmBar[] = [];
  for (let index = 0; index < daily.length; index += 7) {
    const week = daily.slice(index, index + 7);
    weeks.push({
      label: `Week of ${calendarDay(week[0]!.date, { month: 'short', day: 'numeric' })}`,
      centavos: week.reduce((sum, day) => sum + day.recordedCentavos, 0),
      count: week.reduce((sum, day) => sum + day.recordedCount, 0),
    });
  }
  return weeks;
}

/** Both notification-match states have the same user-facing Strong match label. */
export function evidenceBuckets(rows: AnalyticsSummary['byEvidence']): AnalyticsSummary['byEvidence'] {
  const groups = new Map<AnalyticsSummary['byEvidence'][number]['state'], AnalyticsSummary['byEvidence'][number]>();
  for (const row of rows) {
    const state = row.state === 'MATCHED_BY_USER' ? 'MATCHED_AUTO' : row.state;
    const group = groups.get(state) ?? { state, recordedCount: 0, recordedCentavos: 0 };
    group.recordedCount += row.recordedCount;
    group.recordedCentavos += row.recordedCentavos;
    groups.set(state, group);
  }
  return [...groups.values()].sort((a, b) => b.recordedCentavos - a.recordedCentavos);
}

/** Index of the largest bar, or null when nothing was recorded. Ties keep the earliest. */
export function peakIndex(bars: readonly RhythmBar[]): number | null {
  let best: number | null = null;
  bars.forEach((bar, index) => {
    if (bar.centavos > 0 && (best === null || bar.centavos > bars[best]!.centavos)) best = index;
  });
  return best;
}

/** Which bar a touch at `x` falls on, for a chart `width` wide with `count` equal slots. */
export function barAt(x: number, width: number, count: number): number | null {
  if (width <= 0 || count <= 0) return null;
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
}
