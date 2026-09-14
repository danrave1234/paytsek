import * as SecureStore from 'expo-secure-store';
import { PaymentCollector, type CollectorStatus } from 'payment-collector';
import { env } from './env';

export type WalletProvider = 'GCASH' | 'GOTYME' | 'MAYA' | 'MARIBANK';

/**
 * JS-side bookkeeping for the Android collector. The credential itself lives
 * in the native Keystore-backed store; here we only remember that this install
 * is a collector and for which workspace/source, so the UI can render health.
 */
const KEY = 'paytsek.collectorBinding';

export interface CollectorBinding {
  workspaceId: string;
  workspaceName: string;
  sourceLabel: string;
  providers: WalletProvider[];
  /** Read only for migration from pre-V2 single-wallet bindings. */
  provider?: WalletProvider;
  deviceId: string;
  pairedAt: string;
}

export async function getCollectorBinding(): Promise<CollectorBinding | null> {
  const v = await SecureStore.getItemAsync(KEY);
  if (!v) return null;
  const parsed = JSON.parse(v) as CollectorBinding;
  return { ...parsed, providers: parsed.providers ?? (parsed.provider ? [parsed.provider] : []) };
}

export async function activateCollector(binding: CollectorBinding, credential: string): Promise<void> {
  await PaymentCollector.configure({ apiBaseUrl: env.apiUrl, credential, deviceId: binding.deviceId, enabledProviders: binding.providers });
  await SecureStore.setItemAsync(KEY, JSON.stringify(binding));
}

export async function setCollectorProviders(providers: WalletProvider[]): Promise<void> {
  const binding = await getCollectorBinding();
  if (!binding) return;
  const next = { ...binding, providers, provider: undefined };
  await PaymentCollector.setEnabledProviders(providers);
  await SecureStore.setItemAsync(KEY, JSON.stringify(next));
}

export async function deactivateCollector(): Promise<void> {
  await PaymentCollector.clearConfiguration();
  await SecureStore.deleteItemAsync(KEY);
}

export async function collectorStatus(): Promise<CollectorStatus> {
  return PaymentCollector.getStatus();
}

/** Reapply the non-secret provider filter kept in the app binding after upgrades. */
export async function restoreCollectorFilters(): Promise<void> {
  const binding = await getCollectorBinding();
  if (binding) await PaymentCollector.setEnabledProviders(binding.providers);
}

/** Content-free heartbeat (credential never leaves the native Keystore store). */
export async function reportHealth(): Promise<boolean> {
  return PaymentCollector.reportHealth();
}
