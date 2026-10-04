import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
let operations: Promise<unknown> = Promise.resolve();
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const next = operations.catch(() => undefined).then(operation);
  operations = next;
  return next;
}
function parseCount(value: string | null): number {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}
async function previousChunkCount(key: string): Promise<number> {
  let count = parseCount(await SecureStore.getItemAsync(`${key}.n`));
  // Old clients discarded the count on shrink. Their contiguous orphaned
  // chunks must also be erased, including an interrupted larger write.
  while (await SecureStore.getItemAsync(`${key}.${count}`) !== null) count += 1;
  return count;
}
async function removeChunks(key: string, start: number, end: number): Promise<void> {
  for (let index = start; index < end; index++) await SecureStore.deleteItemAsync(`${key}.${index}`);
}

/** Serialized Keychain/Keystore adapter; no session material leaves SecureStore. */
export const secureStorage = {
  getItem(key: string): Promise<string | null> {
    return serialized(async () => {
      const rawCount = await SecureStore.getItemAsync(`${key}.n`);
      if (rawCount === null) return SecureStore.getItemAsync(key);
      const count = parseCount(rawCount);
      if (!count) return null;
      const parts: string[] = [];
      for (let index = 0; index < count; index++) {
        const part = await SecureStore.getItemAsync(`${key}.${index}`);
        if (part === null) return null; // Never return a partially removed session.
        parts.push(part);
      }
      return parts.join('');
    });
  },
  setItem(key: string, value: string): Promise<void> {
    return serialized(async () => {
      const previous = await previousChunkCount(key);
      if (value.length <= CHUNK) {
        await SecureStore.setItemAsync(key, value);
        await removeChunks(key, 0, previous);
        await SecureStore.deleteItemAsync(`${key}.n`);
        return;
      }
      const count = Math.ceil(value.length / CHUNK);
      for (let index = 0; index < count; index++) await SecureStore.setItemAsync(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
      // Retain the old count until obsolete values have actually been removed.
      await removeChunks(key, count, previous);
      await SecureStore.setItemAsync(`${key}.n`, String(count));
      await SecureStore.deleteItemAsync(key);
    });
  },
  removeItem(key: string): Promise<void> {
    return serialized(async () => {
      const count = await previousChunkCount(key);
      await SecureStore.deleteItemAsync(key);
      await removeChunks(key, 0, count);
      await SecureStore.deleteItemAsync(`${key}.n`);
    });
  },
};
