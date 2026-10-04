import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MAX_PROOF_BYTES, validateProofBytes } from './proof-validation';

const expected = (bytes: Buffer, contentType = 'image/png') => ({ size: bytes.length, contentType, sha256: createHash('sha256').update(bytes).digest('hex') });
const fixture = () => sharp({ create: { width: 12, height: 12, channels: 3, background: '#fff' } }).png().toBuffer();

describe('finalized proof bytes', () => {
  it('accepts a complete deterministic decodable PNG', async () => {
    const bytes = await fixture();
    await expect(validateProofBytes(bytes, expected(bytes))).resolves.toBeUndefined();
  });
  it('rejects a changed hash even when size and MIME metadata match', async () => {
    const bytes = await fixture();
    await expect(validateProofBytes(bytes, { ...expected(bytes), sha256: '0'.repeat(64) })).rejects.toThrow('HASH');
  });
  it('rejects a forged MIME header and arbitrary HTML', async () => {
    const bytes = await fixture();
    await expect(validateProofBytes(bytes, expected(bytes, 'image/jpeg'))).rejects.toThrow('TYPE');
    const html = Buffer.from('<html>not a receipt image</html>');
    await expect(validateProofBytes(html, expected(html))).rejects.toThrow('TYPE');
  });
  it('rejects truncated image data with a valid declared hash', async () => {
    const bytes = (await fixture()).subarray(0, 40);
    await expect(validateProofBytes(bytes, expected(bytes))).rejects.toThrow('DECODE');
  });
  it('rejects oversized upload bytes before invoking an image decoder', async () => {
    const bytes = Buffer.alloc(MAX_PROOF_BYTES + 1);
    await expect(validateProofBytes(bytes, expected(bytes))).rejects.toThrow('SIZE');
  });
});
