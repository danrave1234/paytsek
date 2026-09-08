/**
 * Strict Philippine peso parsing. All amounts are integer centavos; floating
 * point is never used for money. Returns null when the text is not an
 * unambiguous PHP amount.
 */

export interface ParsedMoney {
  currency: 'PHP';
  centavos: number;
  /** The exact substring that was interpreted, for provenance. */
  raw: string;
}

const CURRENCY_PREFIX = /(?:₱|PHP|Php|php|P|₱\s|PHP\s)/;

/**
 * Matches: ₱1,250.00 · PHP 1,250.00 · P1250 · 1,250.50 · ₱ 12.5
 * Groups: 1 = integer part (with optional thousands separators), 2 = fractional.
 */
const AMOUNT_RE = /(?:₱|PHP|Php|php|P)?\s?((?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.(\d{1,2}))?(?!\d)/;

function toCentavos(intPart: string, fracPart: string | undefined): number | null {
  const digits = intPart.replace(/,/g, '');
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length > 12) return null;
  const whole = BigInt(digits);
  let frac = 0n;
  if (fracPart !== undefined) {
    if (fracPart.length === 1) frac = BigInt(fracPart) * 10n;
    else frac = BigInt(fracPart);
  }
  const total = whole * 100n + frac;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(total);
}

/** Parse a single amount token such as "₱1,250.00". Whole string must be an amount. */
export function parseMoneyExact(text: string): ParsedMoney | null {
  const trimmed = text.trim();
  const m = new RegExp(`^${AMOUNT_RE.source}$`).exec(trimmed);
  if (!m || m[1] === undefined) return null;
  const centavos = toCentavos(m[1], m[2]);
  if (centavos === null || centavos <= 0) return null;
  return { currency: 'PHP', centavos, raw: trimmed };
}

/**
 * Find all plausible amounts in free text. Requires either a currency prefix
 * or a decimal part so that bare reference numbers / phone numbers are not
 * mistaken for money.
 */
export function findMoneyCandidates(text: string): ParsedMoney[] {
  const results: ParsedMoney[] = [];
  const re = new RegExp(AMOUNT_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const hasPrefix = CURRENCY_PREFIX.test(raw);
    const hasDecimal = m[2] !== undefined;
    const hasThousands = (m[1] ?? '').includes(',');
    if (!hasPrefix && !hasDecimal && !hasThousands) continue;
    // A bare "P" followed by digits inside a word (e.g. "PH12") is not money.
    const before = m.index > 0 ? text[m.index - 1] : ' ';
    if (raw.startsWith('P') && !raw.startsWith('PHP') && before !== undefined && /[A-Za-z0-9]/.test(before)) continue;
    const centavos = toCentavos(m[1] ?? '', m[2]);
    if (centavos === null || centavos <= 0) continue;
    results.push({ currency: 'PHP', centavos, raw: raw.trim() });
  }
  return results;
}

/** Format centavos as "₱1,250.00" for display only. */
export function formatCentavos(centavos: number): string {
  if (!Number.isInteger(centavos)) throw new TypeError('centavos must be an integer');
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}₱${wholeStr}.${frac.toString().padStart(2, '0')}`;
}
