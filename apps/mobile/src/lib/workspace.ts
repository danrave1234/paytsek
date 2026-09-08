import * as SecureStore from 'expo-secure-store';

const KEY = 'payrecord.activeWorkspaceId';
let cached: string | null | undefined;

/** Every action explicitly selects one workspace; the selection is persisted per device. */
export async function getActiveWorkspaceId(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = (await SecureStore.getItemAsync(KEY)) ?? null;
  return cached;
}

export async function setActiveWorkspaceId(id: string | null): Promise<void> {
  cached = id;
  if (id) await SecureStore.setItemAsync(KEY, id);
  else await SecureStore.deleteItemAsync(KEY);
}
