import type { RejectReason } from './types';

/**
 * Reject-first classification shared by every adapter. Runs BEFORE any
 * provider template matching so that OTPs, security prompts, outgoing
 * payments, promotions and failed/pending messages are never treated as
 * incoming-payment evidence and never uploaded.
 */

const OTP_OR_SECURITY = [
  /\bOTP\b/i,
  /one[- ]time\s+(pin|password|code)/i,
  /authentication\s+code/i,
  /verification\s+code/i,
  /\bMPIN\b/i,
  /do\s+not\s+share/i,
  /never\s+share/i,
  /login\s+attempt/i,
  /new\s+device/i,
  /password/i,
  /suspicious/i,
];

const OUTGOING = [
  /\byou\s+(have\s+)?sent\b/i,
  /\byou\s+(have\s+)?paid\b/i,
  /\bpayment\s+(of\s+)?(₱|PHP|P)?\s?[\d,.]+\s+to\b/i,
  /\bsuccessfully\s+sent\b/i,
  /\bhas\s+been\s+sent\b/i,
  /\bcash[- ]?out\b/i,
  /\bwithdraw/i,
  /\bbills?\s+payment\b/i,
  /\bpaid\s+your\b/i,
  /\bbought\b/i,
  /\bload\s+purchase\b/i,
  /\bsent\s+(₱|PHP|P)\s?[\d,.]+/i,
];

const PROMOTION = [
  /\bpromo\b/i,
  /\bvoucher\b/i,
  /\bcashback\b/i,
  /\bdiscount\b/i,
  /\braffle\b/i,
  /\bwin\b/i,
  /\bGForest\b/i,
  /\bGLife\b/i,
  /\bGInvest\b/i,
  /\bGCredit\b/i,
  /\bGLoan\b/i,
  /\bGGives\b/i,
  /\bGSave\b/i,
  /\bGInsure\b/i,
  /\bexclusive\b/i,
  /\blimited\s+time\b/i,
  /\bapply\s+now\b/i,
  /\btap\s+to\s+learn\b/i,
  /\breminder\b/i,
  /\bdue\b/i,
];

const FAILED_OR_PENDING = [
  /\bfailed\b/i,
  /\bunsuccessful\b/i,
  /\bdeclined\b/i,
  /\bpending\b/i,
  /\bprocessing\b/i,
  /\breversed\b/i,
  /\brefund/i,
  /\bcancel/i,
  /\bexpired\b/i,
  /\bnot\s+(be\s+)?completed\b/i,
];

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

/**
 * Returns a rejection reason when the text must NOT be treated as an incoming
 * payment, or null when it passes the negative filters (positive template
 * matching is still required afterwards).
 */
export function classifyNegative(text: string): RejectReason | null {
  if (anyMatch(OTP_OR_SECURITY, text)) return 'OTP_OR_SECURITY';
  if (anyMatch(FAILED_OR_PENDING, text)) return 'FAILED_OR_PENDING';
  if (anyMatch(OUTGOING, text)) return 'OUTGOING_PAYMENT';
  if (anyMatch(PROMOTION, text)) return 'PROMOTION';
  return null;
}
