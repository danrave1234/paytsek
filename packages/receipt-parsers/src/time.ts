import type { TimePrecision } from '@payrecord/contracts';

/** Asia/Manila has no DST; fixed UTC+8. */
const MANILA_OFFSET_MINUTES = 8 * 60;

export interface ParsedTime {
  iso: string;
  precision: TimePrecision;
  raw: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function toUtcIso(y: number, mo: number, d: number, h: number, mi: number, s: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const utcMs = Date.UTC(y, mo - 1, d, h, mi, s) - MANILA_OFFSET_MINUTES * 60_000;
  const dt = new Date(utcMs);
  if (Number.isNaN(dt.getTime())) return null;
  // Reject impossible dates like Feb 30 (Date.UTC would roll over).
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return dt.toISOString();
}

function parseClock(str: string | undefined): { h: number; mi: number; s: number; precision: TimePrecision } | null {
  if (!str) return null;
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/.exec(str);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const s = m[3] !== undefined ? Number(m[3]) : 0;
  const ampm = m[4]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h > 23) return null;
  return { h, mi, s, precision: m[3] !== undefined ? 'SECOND' : 'MINUTE' };
}

/**
 * Parse Philippine receipt/notification date-time text interpreted in
 * Asia/Manila. Supported forms (case-insensitive):
 *   "Sep 08, 2026 1:05 AM" · "September 8, 2026 01:05:33 PM" · "08 Sep 2026, 13:05"
 *   "09/08/2026 1:05 PM" (MM/DD/YYYY) · "2026-09-08 13:05:33" · "09-08-2026 01:05 AM"
 * Returns null on ambiguity/failure — never guesses.
 */
export function parseManilaDateTime(text: string): ParsedTime | null {
  const raw = text.trim();

  // ISO-like: 2026-09-08 13:05[:33]
  let m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?))?/.exec(raw);
  if (m) {
    const clock = parseClock(m[4]);
    const iso = toUtcIso(Number(m[1]), Number(m[2]), Number(m[3]), clock?.h ?? 0, clock?.mi ?? 0, clock?.s ?? 0);
    return iso ? { iso, precision: clock ? clock.precision : 'DAY', raw } : null;
  }

  // Month name first: Sep 08, 2026 1:05 AM
  m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?))?/.exec(raw);
  if (m) {
    const mo = MONTHS[(m[1] ?? '').toLowerCase()];
    if (mo) {
      const clock = parseClock(m[4]);
      const iso = toUtcIso(Number(m[3]), mo, Number(m[2]), clock?.h ?? 0, clock?.mi ?? 0, clock?.s ?? 0);
      return iso ? { iso, precision: clock ? clock.precision : 'DAY', raw } : null;
    }
  }

  // Day first with month name: 08 Sep 2026, 13:05
  m = /(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?))?/.exec(raw);
  if (m) {
    const mo = MONTHS[(m[2] ?? '').toLowerCase()];
    if (mo) {
      const clock = parseClock(m[4]);
      const iso = toUtcIso(Number(m[3]), mo, Number(m[1]), clock?.h ?? 0, clock?.mi ?? 0, clock?.s ?? 0);
      return iso ? { iso, precision: clock ? clock.precision : 'DAY', raw } : null;
    }
  }

  // Numeric MM/DD/YYYY or MM-DD-YYYY (Philippine convention is month-first).
  m = /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?))?/.exec(raw);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // If the first component cannot be a month, the format is ambiguous -> null.
    if (a > 12) return null;
    const clock = parseClock(m[4]);
    const iso = toUtcIso(Number(m[3]), a, b, clock?.h ?? 0, clock?.mi ?? 0, clock?.s ?? 0);
    return iso ? { iso, precision: clock ? clock.precision : 'DAY', raw } : null;
  }

  return null;
}
