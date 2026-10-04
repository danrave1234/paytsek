import { expect, it } from 'vitest';
import { recordPollInterval } from './record-polling';

it('polls briefly for supplementary evidence only while the record is visible', () => {
  expect(recordPollInterval('UNVERIFIED', 1000, 2000)).toBe(15000);
  expect(recordPollInterval('REVIEW_REQUIRED', null, 2000)).toBe(false);
  expect(recordPollInterval('UNVERIFIED', 1000, 121000)).toBe(false);
  for (const state of ['MATCHED_AUTO', 'MATCHED_BY_USER', 'CONFIRMED_MANUALLY', 'VOIDED'] as const) expect(recordPollInterval(state, 1000, 2000)).toBe(false);
});
