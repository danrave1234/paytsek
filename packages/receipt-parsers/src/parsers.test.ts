import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FLOW_REGISTRY,
  NOTIFICATION_ADAPTERS,
  PROVIDER_PACKAGES,
  adapterForPackage,
  autoMatchFlowsForReceivingProvider,
  extractReceiptFields,
  findMoneyCandidates,
  formatCentavos,
  autoMatchFlow,
  normalizeReference,
  parseManilaDateTime,
  parseMoneyExact,
  parseNotification,
  referencesEqual,
} from './index';
import type { NotificationText } from './index';

const FIXTURES = join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const loadJson = <T>(rel: string): T => JSON.parse(readFileSync(join(FIXTURES, rel), 'utf8')) as T;

describe('money', () => {
  it('parses exact PHP amounts into integer centavos', () => {
    expect(parseMoneyExact('₱1,250.00')?.centavos).toBe(125000);
    expect(parseMoneyExact('PHP 1,250.5')?.centavos).toBe(125050);
    expect(parseMoneyExact('P500')?.centavos).toBe(50000);
    expect(parseMoneyExact('0.01')?.centavos).toBe(1);
    expect(parseMoneyExact('0.00')).toBeNull();
    expect(parseMoneyExact('1,25,0.00')).toBeNull();
    expect(parseMoneyExact('12.345')).toBeNull();
    expect(parseMoneyExact('abc')).toBeNull();
  });

  it('never produces floating point drift', () => {
    for (const s of ['0.1', '0.2', '0.3', '1.1', '2.2', '19.99', '1234567.89']) {
      const c = parseMoneyExact(s)!.centavos;
      expect(Number.isInteger(c)).toBe(true);
      expect(formatCentavos(c).replace(/[₱,]/g, '')).toBe(Number(s).toFixed(2));
    }
  });

  it('does not mistake reference or phone numbers for money', () => {
    const found = findMoneyCandidates('Ref No. 1234567890123 from 09171234567 amount ₱1,250.00');
    expect(found.map((f) => f.centavos)).toEqual([125000]);
  });

  it('formats centavos for display', () => {
    expect(formatCentavos(125000)).toBe('₱1,250.00');
    expect(formatCentavos(5)).toBe('₱0.05');
    expect(() => formatCentavos(1.5)).toThrow();
  });
});

describe('reference normalization', () => {
  it('strips spaces but never changes namespace or corrects characters', () => {
    const a = normalizeReference('GCASH_REF_NO', '1234 567 890123');
    expect(a).toEqual({ namespace: 'GCASH_REF_NO', value: '1234567890123', raw: '1234 567 890123' });
    expect(normalizeReference('GCASH_REF_NO', '12345O7890123')).toBeNull(); // letter O -> review, not auto-fix
    expect(normalizeReference('UNKNOWN', '123456789')).toBeNull();
  });

  it('treats identical values in different namespaces as different references', () => {
    const a = normalizeReference('GCASH_REF_NO', '1234567890123');
    const b = normalizeReference('GCASH_EXPRESS_SEND_REF', '1234567890123');
    expect(referencesEqual(a, b)).toBe(false);
    expect(referencesEqual(a, normalizeReference('GCASH_REF_NO', '1234567890123'))).toBe(true);
    expect(referencesEqual(a, null)).toBe(false);
  });
});

describe('time', () => {
  it('interprets Philippine formats as Asia/Manila', () => {
    expect(parseManilaDateTime('Sep 08, 2026 1:05 AM')).toMatchObject({ iso: '2026-09-07T17:05:00.000Z', precision: 'MINUTE' });
    expect(parseManilaDateTime('September 8, 2026 01:05:33 PM')).toMatchObject({ iso: '2026-09-08T05:05:33.000Z', precision: 'SECOND' });
    expect(parseManilaDateTime('08 Sep 2026, 13:05')).toMatchObject({ iso: '2026-09-08T05:05:00.000Z' });
    expect(parseManilaDateTime('09/08/2026 2:30 PM')).toMatchObject({ iso: '2026-09-08T06:30:00.000Z' });
    expect(parseManilaDateTime('2026-09-08')).toMatchObject({ iso: '2026-09-07T16:00:00.000Z', precision: 'DAY' });
  });

  it('returns null instead of guessing', () => {
    expect(parseManilaDateTime('13/08/2026')).toBeNull();
    expect(parseManilaDateTime('Feb 30, 2026')).toBeNull();
    expect(parseManilaDateTime('hello')).toBeNull();
  });
});

describe('capability registry', () => {
  it('only enables auto-match for flows with comparable namespaces', () => {
    for (const f of FLOW_REGISTRY) {
      if (f.autoMatchEnabled) {
        expect(f.referenceNamespacesComparable).toBe(true);
        expect(f.notificationReferenceNamespace).not.toBeNull();
      }
      if (!f.autoMatchEnabled) expect(f.disabledReason).toBeTruthy();
    }
  });

  it('never invents cross-provider reference mapping', () => {
    const gcashToGcash = {
      receiptProvider: 'GCASH',
      receivingProvider: 'GCASH',
      rail: 'EXPRESS_SEND',
      receiptNamespace: 'GCASH_REF_NO',
      notificationNamespace: 'GCASH_REF_NO',
    } as const;

    expect(autoMatchFlow(gcashToGcash).comparable).toBe(true);
    expect(autoMatchFlow({ ...gcashToGcash, receiptProvider: 'GOTYME', receiptNamespace: 'GOTYME_REF_NO' }).comparable).toBe(false);
    expect(autoMatchFlow({ ...gcashToGcash, receiptNamespace: null }).reason).toBe('MISSING_REFERENCE');
    expect(autoMatchFlowsForReceivingProvider('GOTYME')).toEqual([]);
  });

  it('resolves the flow by rail, so an untested rail cannot borrow an enabled one', () => {
    const base = {
      receiptProvider: 'GCASH',
      receivingProvider: 'GCASH',
      receiptNamespace: 'GCASH_REF_NO',
      notificationNamespace: 'GCASH_REF_NO',
    } as const;

    expect(autoMatchFlow({ ...base, rail: 'EXPRESS_SEND' }).flowId).toBe('gcash-to-gcash.express-send');
    expect(autoMatchFlow({ ...base, rail: 'QR_P2P' })).toMatchObject({
      comparable: true,
      flowId: 'gcash-to-gcash.qr-p2p',
    });
    // Merchant QR shares the namespace but its notification carries no
    // reference, so it must never borrow an enabled rail's rule.
    expect(autoMatchFlow({ ...base, rail: 'QR_MERCHANT' })).toMatchObject({
      comparable: false,
      flowId: 'gcash-to-gcash.qr-merchant',
      reason: 'FLOW_NOT_ENABLED',
    });
    // A rail with no registered flow is never guessed at.
    expect(autoMatchFlow({ ...base, rail: 'PESONET' }).reason).toBe('UNKNOWN_FLOW');
    expect(autoMatchFlow({ ...base, rail: null }).reason).toBe('UNKNOWN_FLOW');
  });

  it('records Maya but never auto-matches it without a verified sample', () => {
    expect(autoMatchFlowsForReceivingProvider('MAYA')).toEqual([]);
    expect(
      autoMatchFlow({
        receiptProvider: 'MAYA',
        receivingProvider: 'MAYA',
        rail: 'QR_P2P',
        receiptNamespace: 'MAYA_REF_NO',
        notificationNamespace: 'MAYA_REF_NO',
      }).comparable,
    ).toBe(false);
    expect(
      autoMatchFlow({
        receiptProvider: 'MAYA',
        receivingProvider: 'GCASH',
        rail: 'INSTAPAY',
        receiptNamespace: 'MAYA_REF_NO',
        notificationNamespace: 'GCASH_REF_NO',
      }).comparable,
    ).toBe(false);
  });
});

describe('wallet coverage', () => {
  const WALLETS = ['GCASH', 'GOTYME', 'MAYA', 'MARIBANK'] as const;

  it('registers one notification adapter per supported wallet', () => {
    expect(NOTIFICATION_ADAPTERS.map((a) => a.provider).sort()).toEqual([...WALLETS].sort());
  });

  it('resolves every allowlisted package to its adapter', () => {
    for (const wallet of WALLETS) {
      for (const pkg of PROVIDER_PACKAGES[wallet]) {
        expect(adapterForPackage(pkg)?.provider).toBe(wallet);
      }
    }
  });

  it('rejects unsupported wallets as UNKNOWN_TEMPLATE, not UNKNOWN_PACKAGE', () => {
    // The Kotlin parser reports UNKNOWN_TEMPLATE for these, and only that
    // reason is eligible for opt-in shape capture — so the two must agree.
    for (const wallet of ['GOTYME', 'MAYA', 'MARIBANK'] as const) {
      const res = parseNotification({
        packageName: PROVIDER_PACKAGES[wallet][0]!,
        title: 'Anything',
        text: 'You have received PHP 1,250.00',
        bigText: null,
        textLines: [],
        isGroupSummary: false,
      });
      expect(res).toEqual({ ok: false, reason: 'UNKNOWN_TEMPLATE' });
    }
  });

  it('rejects a wallet that is not on the allowlist at all', () => {
    const res = parseNotification({
      packageName: 'com.example.otherbank',
      title: 'You have received PHP 1,250.00',
      text: null,
      bigText: null,
      textLines: [],
      isGroupSummary: false,
    });
    expect(res).toEqual({ ok: false, reason: 'UNKNOWN_PACKAGE' });
  });
});

describe('MariBank recording support', () => {
  it('detects both the MariBank and legacy SeaBank brands', () => {
    for (const brand of ['MariBank', 'SeaBank']) {
      const r = extractReceiptFields(`${brand}
Transfer Successful
Amount PHP 480.00
Reference No. MB99887766
Sent to Aling Nena`);
      expect(r.fields.receiptProvider).toBe('MARIBANK');
      expect(r.fields.referenceNamespace).toBe('MARIBANK_REF_NO');
      expect(r.fields.amountCentavos).toBe(48000);
    }
  });

  it('never auto-matches MariBank without a verified sample', () => {
    expect(autoMatchFlowsForReceivingProvider('MARIBANK')).toEqual([]);
    expect(
      autoMatchFlow({
        receiptProvider: 'MARIBANK',
        receivingProvider: 'MARIBANK',
        rail: 'QR_P2P',
        receiptNamespace: 'MARIBANK_REF_NO',
        notificationNamespace: 'MARIBANK_REF_NO',
      }),
    ).toMatchObject({ comparable: false, reason: 'FLOW_NOT_ENABLED' });
  });
});

describe('Maya recording support', () => {
  it('detects the Maya brand and files the reference in its own namespace', () => {
    const r = extractReceiptFields('Maya\nPayment Successful\nAmount ₱1,250.00\nReference No. MYA123456789\nSent to Aling Nena');
    expect(r.fields.receiptProvider).toBe('MAYA');
    expect(r.fields.referenceNamespace).toBe('MAYA_REF_NO');
    expect(r.fields.referenceValue).toBe('MYA123456789');
    expect(r.fields.amountCentavos).toBe(125000);
  });

  it('stays unknown when a confirmation names two wallets outside the header', () => {
    const r = extractReceiptFields('Payment Successful\nAmount ₱100.00\nFrom Maya wallet\nSent to GCash account');
    expect(r.fields.receiptProvider).toBeNull();
  });

  it('normalizes a Maya reference only within MAYA_REF_NO', () => {
    expect(normalizeReference('MAYA_REF_NO', 'mya 1234 5678')?.value).toBe('MYA12345678');
    expect(normalizeReference('MAYA_REF_NO', 'abc')).toBeNull();
  });
});

interface NotifFixture {
  packageName: string;
  cases: Array<{
    id: string;
    expect: 'ACCEPT' | 'REJECT';
    reason?: string;
    packageNameOverride?: string;
    input: Omit<NotificationText, 'packageName'>;
    expected?: Record<string, unknown>;
  }>;
}

describe('GCash notification adapter (SYNTHETIC fixtures)', () => {
  const fx = loadJson<NotifFixture>('notifications/gcash.json');
  for (const c of fx.cases) {
    it(c.id, () => {
      const result = parseNotification({ ...c.input, packageName: c.packageNameOverride ?? fx.packageName });
      if (c.expect === 'REJECT') {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe(c.reason);
      } else {
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.event.currency).toBe('PHP');
          expect(Number.isInteger(result.event.amountCentavos)).toBe(true);
          expect(result.event).toMatchObject(c.expected ?? {});
        }
      }
    });
  }

  it('fails closed for GoTyme (no real sample available)', () => {
    const r = parseNotification({
      packageName: 'com.gotyme.gotymebank',
      title: 'GoTyme',
      text: 'You received ₱100.00 from Someone',
      bigText: null,
      textLines: [],
      isGroupSummary: false,
    });
    expect(r).toEqual({ ok: false, reason: 'UNKNOWN_TEMPLATE' });
  });

  it('never accepts an unknown package even with a perfect template', () => {
    const r = parseNotification({
      packageName: 'com.android.messaging',
      title: 'GCash',
      text: 'You have received PHP 1,000.00 from JU•N D.',
      bigText: null,
      textLines: [],
      isGroupSummary: false,
    });
    expect(r).toEqual({ ok: false, reason: 'UNKNOWN_PACKAGE' });
  });
});

interface ReceiptFixture {
  cases: Array<{ id: string; ocrText: string; expected: Record<string, unknown>; expectLowReadability?: boolean }>;
}

describe('receipt extraction (SYNTHETIC fixtures)', () => {
  const fx = loadJson<ReceiptFixture>('receipts/receipts.json');
  for (const c of fx.cases) {
    it(c.id, () => {
      const r = extractReceiptFields(c.ocrText);
      expect(r.fields).toMatchObject(c.expected);
      if (c.expectLowReadability) expect(r.readabilityScore).toBeLessThan(0.6);
      // Payee is never copied into payer fields.
      if (r.fields.payeeName) expect(r.fields.payerName).not.toBe(r.fields.payeeName);
    });
  }

  it('keeps amount, fee and total separate and never adjusts printed values', () => {
    const r = extractReceiptFields('GCash\nAmount ₱100.00\nService Fee ₱15.00\nTotal Amount Sent ₱120.00');
    expect(r.fields.amountCentavos).toBe(10000);
    expect(r.fields.feeCentavos).toBe(1500);
    expect(r.fields.totalChargedCentavos).toBe(12000);
    expect(r.warnings.some((w) => /does not equal total/.test(w))).toBe(true);
  });
});
