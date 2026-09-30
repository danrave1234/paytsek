import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_MS = 5 * 60_000;

/** Verify `t=<unix-seconds>,v1=<hex>` against HMAC-SHA256(`${t}.${rawBody}`). */
export function verifyTimestampedWebhookSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string,
  nowMs = Date.now(),
  toleranceMs = DEFAULT_TOLERANCE_MS,
): boolean {
  if (!rawBody || !signature || !secret) return false;
  const fields = new Map(
    signature
      .split(',')
      .map((part) => part.trim().split('=', 2) as [string, string])
      .filter(([key, value]) => Boolean(key && value)),
  );
  const timestamp = fields.get('t');
  const received = fields.get('v1') ?? fields.get('li') ?? fields.get('te');
  if (!timestamp || !received || !/^\d+$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(received)) return false;
  if (Math.abs(nowMs - Number(timestamp) * 1000) > toleranceMs) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  const receivedBytes = Buffer.from(received, 'hex');
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}
