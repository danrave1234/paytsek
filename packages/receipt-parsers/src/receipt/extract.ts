import type { PaymentRail, Provider, ReceiptFields, ReceiptStatus, ReferenceNamespace } from '@payrecord/contracts';
import { findMoneyCandidates } from '../money';
import { normalizeReference } from '../reference';
import { parseManilaDateTime } from '../time';

export const RECEIPT_PARSER_ID = 'receipt.generic-label.v1';
export const RECEIPT_PARSER_VERSION = '1';

export interface ReceiptExtraction {
  parserId: string;
  parserVersion: string;
  fields: ReceiptFields;
  /** Which source line each field came from, for provenance display. */
  provenance: Partial<Record<keyof ReceiptFields, string>>;
  /** 0..1 — share of expected fields found; drives the low-readability warning. */
  readabilityScore: number;
  warnings: string[];
}

const EMPTY_FIELDS: ReceiptFields = {
  receiptProvider: null,
  paymentRail: null,
  currency: null,
  amountCentavos: null,
  feeCentavos: null,
  totalChargedCentavos: null,
  referenceNamespace: null,
  referenceValue: null,
  payerName: null,
  payerPhone: null,
  payeeName: null,
  payeePhone: null,
  receiptTransactionAt: null,
  receiptTransactionPrecision: 'UNKNOWN',
  receiptStatus: 'UNKNOWN',
};

const PHONE_RE = /(?:\+?63|0)\s?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/;

const GCASH_BRAND = /\bGCash\b|\bExpress\s+Send\b|\bGlobe\s+Fintech\b/i;
const GOTYME_BRAND = /\bGoTyme\b|\bGo\s*Tyme\b/i;

function detectProvider(lines: string[]): Provider | null {
  const text = lines.join('\n');
  const gcash = GCASH_BRAND.test(text);
  const gotyme = GOTYME_BRAND.test(text);
  if (gcash && !gotyme) return 'GCASH';
  if (gotyme && !gcash) return 'GOTYME';
  if (gcash && gotyme) {
    // A transfer receipt often names the destination wallet too (e.g. GoTyme -> GCash).
    // The issuing app's brand is on the header; only trust the first two lines.
    const header = lines.slice(0, 2).join('\n');
    const h1 = GCASH_BRAND.test(header);
    const h2 = GOTYME_BRAND.test(header);
    if (h1 && !h2) return 'GCASH';
    if (h2 && !h1) return 'GOTYME';
  }
  return null; // ambiguous or neither -> unknown, never guessed
}

function detectRail(text: string, provider: Provider | null): PaymentRail | null {
  if (/\bExpress\s+Send\b/i.test(text)) return 'EXPRESS_SEND';
  if (/\bInstaPay\b/i.test(text)) return 'INSTAPAY';
  if (/\bPESONet\b/i.test(text)) return 'PESONET';
  if (/\bQR\s*Ph\b|\bScan\s+to\s+Pay\b|\bQR\b/i.test(text)) {
    if (/\bmerchant\b|\bstore\b|\bbusiness\b/i.test(text)) return 'QR_MERCHANT';
    return 'QR_P2P';
  }
  if (provider === 'GOTYME' && /\btransfer\b/i.test(text)) return 'BANK_TRANSFER';
  return null;
}

function detectStatus(text: string): ReceiptStatus {
  if (/\bfailed\b|\bunsuccessful\b|\bdeclined\b/i.test(text)) return 'FAILED';
  if (/\bpending\b|\bprocessing\b/i.test(text)) return 'PENDING';
  if (/\bsuccess(ful)?\b|\bsent\s+via\b|\bcompleted\b|\btransfer\s+successful\b|\bpayment\s+successful\b/i.test(text))
    return 'SUCCESS';
  return 'UNKNOWN';
}

function namespaceFor(provider: Provider | null, rail: PaymentRail | null): ReferenceNamespace | null {
  if (provider === 'GCASH') return rail === 'EXPRESS_SEND' ? 'GCASH_REF_NO' : 'GCASH_REF_NO';
  if (provider === 'GOTYME') return 'GOTYME_REF_NO';
  return null;
}

/** Value on the same line after a label, or on the next non-empty line. */
function valueAfterLabel(lines: string[], labelRe: RegExp): { value: string; line: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = labelRe.exec(line);
    if (!m) continue;
    const rest = line.slice(m.index + m[0].length).replace(/^[\s:.\-–]+/, '').trim();
    if (rest.length > 0) return { value: rest, line };
    const next = lines.slice(i + 1).find((l) => l.trim().length > 0);
    if (next) return { value: next.trim(), line: `${line} / ${next.trim()}` };
  }
  return null;
}

function splitNameAndPhone(value: string): { name: string | null; phone: string | null } {
  const phone = PHONE_RE.exec(value);
  const name = value.replace(PHONE_RE, '').replace(/[()|,]+/g, ' ').replace(/\s+/g, ' ').trim();
  return { name: name.length >= 2 ? name : null, phone: phone ? phone[0].replace(/\s+/g, ' ').trim() : null };
}

/**
 * Extract receipt fields from OCR text. Label-driven and conservative:
 *  - "Amount" is the transfer principal; "Total Amount Sent"/"Total" is the total charged; fee is separate.
 *  - "Sent to / To / Recipient / Receiver / Pay to" is the PAYEE (the seller). It is never placed in payer fields.
 *  - "From / Sender / Paid by" is the PAYER.
 *  - Missing fields stay null. Nothing is inferred from other fields.
 */
export function extractReceiptFields(fullText: string): ReceiptExtraction {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
  const text = lines.join('\n');
  const fields: ReceiptFields = { ...EMPTY_FIELDS };
  const provenance: ReceiptExtraction['provenance'] = {};
  const warnings: string[] = [];

  fields.receiptProvider = detectProvider(lines);
  fields.paymentRail = detectRail(text, fields.receiptProvider);
  fields.receiptStatus = detectStatus(text);

  // --- Amounts --------------------------------------------------------------
  const total = valueAfterLabel(lines, /\b(?:Total\s+Amount(?:\s+Sent|\s+Paid)?|Total\s+Paid|Total)\b/i);
  const fee = valueAfterLabel(lines, /\b(?:Service\s+Fee|Transaction\s+Fee|Convenience\s+Fee|Fee)\b/i);
  // "Amount" that is not part of "Total Amount ..." — the transfer principal.
  const amount = valueAfterLabel(lines, /(?<!Total\s)\bAmount\b(?:\s+(?:Sent|Paid|Transferred))?/i);

  const firstMoney = (v: string | undefined) => (v ? findMoneyCandidates(v)[0]?.centavos ?? null : null);

  fields.feeCentavos = fee ? (findMoneyCandidates(fee.value)[0]?.centavos ?? 0) : null;
  if (fee && fields.feeCentavos !== null) provenance.feeCentavos = fee.line;

  const totalC = firstMoney(total?.value);
  if (totalC !== null && total) {
    fields.totalChargedCentavos = totalC;
    provenance.totalChargedCentavos = total.line;
  }

  let amountC = firstMoney(amount?.value);
  if (amountC !== null && amount) {
    fields.amountCentavos = amountC;
    provenance.amountCentavos = amount.line;
  } else {
    // No "Amount" label: fall back to a single prominent currency-prefixed value.
    const prefixed = findMoneyCandidates(text).filter((c) => /^(₱|PHP|Php|P)/.test(c.raw));
    const distinct = [...new Set(prefixed.map((c) => c.centavos))];
    if (distinct.length === 1 && distinct[0] !== undefined) {
      amountC = distinct[0];
      fields.amountCentavos = amountC;
      provenance.amountCentavos = prefixed[0]?.raw ?? '';
      warnings.push('Amount taken from a single prominent value; no "Amount" label found.');
    } else if (distinct.length > 1) {
      warnings.push('Multiple different amounts found; please confirm the amount.');
    }
  }
  if (fields.amountCentavos !== null) fields.currency = 'PHP';

  // Consistency: if total and fee are present and disagree with amount, warn (never adjust).
  if (
    fields.amountCentavos !== null &&
    fields.totalChargedCentavos !== null &&
    fields.feeCentavos !== null &&
    fields.amountCentavos + fields.feeCentavos !== fields.totalChargedCentavos
  ) {
    warnings.push('Amount + fee does not equal total; values kept as printed.');
  }

  // --- Reference ------------------------------------------------------------
  const ref = valueAfterLabel(lines, /\b(?:Ref(?:erence)?\.?\s*(?:No\.?|Number|#|ID)?|Transaction\s+(?:ID|No\.?|Number))\b/i);
  const ns = namespaceFor(fields.receiptProvider, fields.paymentRail);
  if (ref && ns) {
    const digitsOnly = ref.value.match(/[\dA-Za-z][\dA-Za-z\s-]{5,30}/)?.[0] ?? ref.value;
    const normalized = normalizeReference(ns, digitsOnly);
    if (normalized) {
      fields.referenceNamespace = ns;
      fields.referenceValue = normalized.value;
      provenance.referenceValue = ref.line;
    } else {
      warnings.push('Reference number found but could not be normalized; please check it.');
    }
  } else if (ref && !ns) {
    warnings.push('Reference number visible but provider unknown; namespace left empty.');
  }

  // --- Parties (payer vs payee, never merged) --------------------------------
  const payee = valueAfterLabel(lines, /\b(?:Sent\s+to|Send\s+to|To|Recipient|Receiver|Pay(?:ed|)\s+to|Paid\s+to|Beneficiary)\b/i);
  if (payee) {
    const { name, phone } = splitNameAndPhone(payee.value);
    fields.payeeName = name;
    fields.payeePhone = phone;
    if (name) provenance.payeeName = payee.line;
    if (phone) provenance.payeePhone = payee.line;
  }
  const payer = valueAfterLabel(lines, /\b(?:From|Sender|Paid\s+by|Sent\s+by|Payer)\b/i);
  if (payer) {
    const { name, phone } = splitNameAndPhone(payer.value);
    fields.payerName = name;
    fields.payerPhone = phone;
    if (name) provenance.payerName = payer.line;
    if (phone) provenance.payerPhone = payer.line;
  }

  // --- Time -----------------------------------------------------------------
  for (const line of lines) {
    const t = parseManilaDateTime(line);
    if (t) {
      fields.receiptTransactionAt = t.iso;
      fields.receiptTransactionPrecision = t.precision;
      provenance.receiptTransactionAt = line;
      break;
    }
  }

  // --- Readability -------------------------------------------------------------
  const expected: (keyof ReceiptFields)[] = ['receiptProvider', 'amountCentavos', 'referenceValue', 'receiptTransactionAt', 'payeeName'];
  const found = expected.filter((k) => fields[k] !== null).length;
  const readabilityScore = Math.round((found / expected.length) * 100) / 100;
  if (readabilityScore < 0.6) warnings.push('Low readability: several expected fields were not found.');

  return { parserId: RECEIPT_PARSER_ID, parserVersion: RECEIPT_PARSER_VERSION, fields, provenance, readabilityScore, warnings };
}
