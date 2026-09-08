import * as SecureStore from 'expo-secure-store';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { env } from './env';

/**
 * JS-side bookkeeping for the Android collector. The credential itself lives
 * in the native Keystore-backed store; here we only remember that this install
 * is a collector and for which workspace/source, so the UI can render health.
 */
const KEY = 'payrecord.collectorBinding';

export interface CollectorBinding {
  workspaceId: string;
  workspaceName: string;
  sourceLabel: string;
  provider: 'GCASH' | 'GOTYME';
  deviceId: string;
  pairedAt: string;
}

export async function getCollectorBinding(): Promise<CollectorBinding | null> {
  const v = await SecureStore.getItemAsync(KEY);
  return v ? (JSON.parse(v) as CollectorBinding) : null;
}

export async function activateCollector(binding: CollectorBinding, credential: string): Promise<void> {
  await PaymentCollector.configure({ apiBaseUrl: env.apiUrl, credential, deviceId: binding.deviceId, enabledProviders: [binding.provider] });
  await SecureStore.setItemAsync(KEY, JSON.stringify(binding));
}

export async function deactivateCollector(): Promise<void> {
  await PaymentCollector.clearConfiguration();
  await SecureStore.deleteItemAsync(KEY);
}

export async function collectorStatus(): Promise<CollectorStatus> {
  return PaymentCollector.getStatus();
}

/** Content-free heartbeat (credential never leaves the native Keystore store). */
export async function reportHealth(): Promise<boolean> {
  return PaymentCollector.reportHealth();
}
