import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../config/env';

/** HMAC-SHA256 of a secret token; only hashes are stored. */
export function hashSecret(token: string): string {
  return createHmac('sha256', loadEnv().COLLECTOR_TOKEN_HASH_SECRET).update(token).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Collector credential: 32 random bytes, base64url, prefixed for identification. */
export function generateCollectorCredential(): string {
  return `prc_${randomBytes(32).toString('base64url')}`;
}

/** Invitation token. */
export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Short pairing code: 10 chars from an unambiguous alphabet (no 0/O/1/I),
 * ~47 bits of entropy, single-use, 5-minute TTL, rate-limited server-side.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePairingCode(): string {
  let out = '';
  for (let i = 0; i < 10; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

export function normalizePairingCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
