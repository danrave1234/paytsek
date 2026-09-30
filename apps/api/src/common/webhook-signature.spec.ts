import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyTimestampedWebhookSignature } from './webhook-signature';

describe('verifyTimestampedWebhookSignature', () => {
  const body = Buffer.from('{"eventId":"safe-fixture"}');
  const secret = 'fixture-secret-that-is-long-enough';
  const now = Date.parse('2026-10-01T00:00:00.000Z');
  const timestamp = Math.floor(now / 1000);
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body.toString('utf8')}`).digest('hex');

  it('accepts a current signature and rejects tampering or replay', () => {
    expect(verifyTimestampedWebhookSignature(body, `t=${timestamp},v1=${digest}`, secret, now)).toBe(true);
    expect(verifyTimestampedWebhookSignature(Buffer.from('{}'), `t=${timestamp},v1=${digest}`, secret, now)).toBe(false);
    expect(verifyTimestampedWebhookSignature(body, `t=${timestamp - 601},v1=${digest}`, secret, now)).toBe(false);
  });
});
