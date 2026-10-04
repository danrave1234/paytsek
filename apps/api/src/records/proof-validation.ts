import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const MAX_PROOF_BYTES = 25 * 1024 * 1024;
export const MAX_PROOF_PIXELS = 24_000_000;

function detectedType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/** Receipts arrive normalized by the native client. No SVG, animation, arbitrary
 * MIME claims or decompression bombs become finalized proof objects. */
export async function validateProofBytes(bytes: Buffer, expected: { size: number; contentType: string; sha256: string }): Promise<void> {
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES || bytes.length !== expected.size) throw new Error('PROOF_INVALID_SIZE');
  if (createHash('sha256').update(bytes).digest('hex') !== expected.sha256) throw new Error('PROOF_HASH_MISMATCH');
  if (detectedType(bytes) !== expected.contentType) throw new Error('PROOF_INVALID_TYPE');
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_PROOF_PIXELS, failOn: 'warning', animated: false });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PROOF_PIXELS || (metadata.pages ?? 1) !== 1) {
      throw new Error('dimensions');
    }
    // Metadata parsing alone does not prove the pixel data decodes successfully.
    await image.timeout({ seconds: 3 }).resize(1, 1).raw().toBuffer();
  } catch {
    throw new Error('PROOF_DECODE_FAILED');
  }
}
