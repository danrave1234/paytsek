import type { ReferenceNamespace } from '@payrecord/contracts';

export const REFERENCE_NORMALIZATION_VERSION = '1';

export interface NormalizedReference {
  namespace: ReferenceNamespace;
  /** Canonical comparable value. */
  value: string;
  /** The text as extracted, before normalization. */
  raw: string;
}

/**
 * Normalize a reference value inside its namespace. Normalization never
 * changes the namespace, and a value from one namespace is never rewritten
 * into another. A transaction identifier is a string, never an integer.
 */
export function normalizeReference(namespace: ReferenceNamespace, raw: string): NormalizedReference | null {
  const compact = raw.replace(/[\s\u00a0]/g, '').replace(/[^\w-]/g, '').toUpperCase();
  if (compact.length === 0) return null;

  switch (namespace) {
    case 'GCASH_REF_NO':
    case 'GCASH_EXPRESS_SEND_REF': {
      // Observed GCash reference numbers are digit-only (commonly 13 digits). OCR may
      // insert spaces; letters O/I are common misreads but we do NOT auto-correct —
      // a suspicious value must go to review, not be silently changed.
      const digits = compact.replace(/-/g, '');
      if (!/^\d{8,20}$/.test(digits)) return null;
      return { namespace, value: digits, raw };
    }
    case 'GOTYME_REF_NO': {
      if (!/^[A-Z0-9-]{6,40}$/.test(compact)) return null;
      return { namespace, value: compact, raw };
    }
    case 'INSTAPAY_TRACE_NO':
    case 'PESONET_TRACE_NO': {
      if (!/^[A-Z0-9]{6,40}$/.test(compact.replace(/-/g, ''))) return null;
      return { namespace, value: compact.replace(/-/g, ''), raw };
    }
    case 'UNKNOWN':
    default:
      return null;
  }
}

/**
 * Two references are equal only if both namespace and normalized value are
 * equal. Cross-namespace comparability is decided by the capability registry,
 * never here.
 */
export function referencesEqual(a: NormalizedReference | null, b: NormalizedReference | null): boolean {
  if (!a || !b) return false;
  return a.namespace === b.namespace && a.value === b.value;
}

/** Digit-only OCR hygiene: strips spaces only. Does not fix character misreads. */
export function looksLikeReferenceDigits(text: string): boolean {
  return /^\d(?:[\d ]{6,}\d)$/.test(text.trim());
}
