import type { EvidenceState } from '@paytsek/contracts';

export function recordPollInterval(state: EvidenceState | undefined, visibleSince: number | null, now = Date.now()): number | false {
  if (visibleSince === null || now - visibleSince >= 120_000) return false;
  if (state && state !== 'UNVERIFIED' && state !== 'REVIEW_REQUIRED') return false;
  return 15_000;
}
