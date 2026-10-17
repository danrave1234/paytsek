import { describe, expect, it } from 'vitest';
import { barAt, dailyBuckets, hourLabel, hourlyBuckets, peakIndex, shortDay } from './rhythm';

describe('rhythm buckets', () => {
  it('labels hours on a 12-hour clock', () => {
    expect([0, 2, 11, 12, 13, 24].map(hourLabel)).toEqual(['12 AM', '2 AM', '11 AM', '12 PM', '1 PM', '12 AM']);
  });

  it('groups 24 hourly totals into twelve two-hour buckets', () => {
    const hourly = Array.from({ length: 24 }, (_, hour) => (hour === 10 || hour === 11 ? 500 : 0));
    const bars = hourlyBuckets(hourly);
    expect(bars).toHaveLength(12);
    expect(bars[5]).toEqual({ label: '10 AM – 12 PM', centavos: 1000, count: null });
    expect(bars[11]!.label).toBe('10 PM – 12 AM');
  });

  it('tolerates short hourly arrays', () => {
    expect(hourlyBuckets([100]).map((bar) => bar.centavos)).toEqual([100, ...Array(11).fill(0)]);
  });

  it('keeps calendar days stable regardless of device timezone', () => {
    const bars = dailyBuckets([{ date: '2026-10-14', recordedCount: 2, recordedCentavos: 2500 }], '7D');
    expect(bars[0]).toEqual({ label: expect.stringMatching(/Wed.*Oct.*14/), centavos: 2500, count: 2 });
  });

  it('formats axis dates without shifting days', () => {
    expect(shortDay('2026-10-01')).toBe('Oct 1');
  });

  it('groups 90 days into weekly bars', () => {
    const daily = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-10-${String(index + 1).padStart(2, '0')}`,
      recordedCount: 1,
      recordedCentavos: 100,
    }));
    const bars = dailyBuckets(daily, '90D');
    expect(bars).toHaveLength(2);
    expect(bars[1]).toEqual({ label: expect.stringMatching(/^Week of Oct 8$/), centavos: 700, count: 7 });
  });

  it('finds the earliest peak and ignores empty charts', () => {
    const bar = (centavos: number) => ({ label: '', centavos, count: null });
    expect(peakIndex([bar(0), bar(5), bar(5), bar(1)])).toBe(1);
    expect(peakIndex([bar(0), bar(0)])).toBeNull();
  });

  it('maps touch positions onto bar slots and clamps the edges', () => {
    expect(barAt(0, 120, 12)).toBe(0);
    expect(barAt(59, 120, 12)).toBe(5);
    expect(barAt(500, 120, 12)).toBe(11);
    expect(barAt(-5, 120, 12)).toBe(0);
    expect(barAt(10, 0, 12)).toBeNull();
  });
});
