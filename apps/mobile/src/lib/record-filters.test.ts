import { describe, expect, it } from 'vitest';
import { matchesRecordFilters } from './record-filters';
import { draftFixture, recordFixture } from './test-fixtures';

describe('visible record filters', () => {
  it.each(['1250', '1,250', '1,250.00', '₱1,250.00', 'PHP 1,250.00', 'P1250', ' 1250.00 '])(
    'finds local and synced records by the exact amount %s', (q) => {
      const local = draftFixture();
      const rows = [
        { ...local.request.corrected, amountCentavos: 125000, evidenceState: 'UNVERIFIED' as const },
        recordFixture({ amountCentavos: 125000 }),
      ];
      expect(rows.map((row) => matchesRecordFilters(row, { q }))).toEqual([true, true]);
    },
  );

  it.each(['12.345', '1,2,5', '1e2', '0x64', '+100', 'P1H0P0', '%', '_', '100 00'])('does not reinterpret %s as a visible match', (q) => {
    for (const amountCentavos of [1235, 12500, 10000, 1000000]) {
      expect(matchesRecordFilters(recordFixture({ amountCentavos, receiptProvider: 'GCASH' }), { q })).toBe(false);
    }
  });

  it('searches visible wallet labels case-insensitively, including unknown wallets', () => {
    expect(matchesRecordFilters(recordFixture({ receiptProvider: 'GCASH' }), { q: ' caSH ' })).toBe(true);
    expect(matchesRecordFilters(recordFixture({ receiptProvider: null }), { q: 'Unknown wallet' })).toBe(true);
  });

  it('does not search hidden payer, notes, or receiving-wallet fields', () => {
    const row = recordFixture({ payerName: 'Synthetic payer', customerLabel: 'Synthetic customer', note: 'Synthetic note', receivingProvider: 'MAYA' });
    for (const q of ['Synthetic', 'Maya']) expect(matchesRecordFilters(row, { q })).toBe(false);
  });

  it('keeps cached rows only when all currently selected filters match', () => {
    const cached = [
      recordFixture({ receiptProvider: 'GCASH', evidenceState: 'MATCHED_AUTO' }),
      recordFixture({ receiptProvider: 'MAYA', evidenceState: 'UNVERIFIED' }),
      recordFixture({ receiptProvider: 'GCASH', evidenceState: 'MATCHED_BY_USER' }),
      recordFixture({ receiptProvider: 'MAYA', evidenceState: 'MATCHED_AUTO' }),
    ];
    expect(cached.filter((row) => matchesRecordFilters(row, { provider: 'GCASH', state: ['MATCHED_AUTO', 'MATCHED_BY_USER'], q: '100.00' })))
      .toEqual([cached[0], cached[2]]);
    expect(matchesRecordFilters(cached[0]!, { q: '100.01' })).toBe(false);
    expect(matchesRecordFilters(cached[0]!, { q: '  ', state: [] })).toBe(true);
  });
});
