import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'paytsek.installId';

/**
 * App-generated install id (UUID v4). Never a hardware identifier (no IMEI,
 * no advertising id). Regenerated only on reinstall.
 */
export async function getInstallId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}

export const platform: 'ANDROID' | 'IOS' = Platform.OS === 'android' ? 'ANDROID' : 'IOS';
export const osVersion = String(Platform.Version);

export const newId = (): string => Crypto.randomUUID();

/** SHA-256 over the exact retained evidence bytes (consistency of bytes, not authenticity). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
