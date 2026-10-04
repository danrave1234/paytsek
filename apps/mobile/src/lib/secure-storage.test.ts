import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ data: new Map<string, string>(), remove: vi.fn() }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => state.data.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { state.data.set(key, value); },
  deleteItemAsync: state.remove,
}));
import { secureStorage } from './secure-storage';

const key = 'synthetic-auth-session';
beforeEach(() => {
  state.data.clear();
  state.remove.mockReset().mockImplementation(async (entry: string) => { state.data.delete(entry); });
});
describe('secure session storage cleanup', () => {
  it('removes every old chunk when a session shrinks to one value', async () => {
    await secureStorage.setItem(key, 'synthetic'.repeat(900));
    await secureStorage.setItem(key, 'short-synthetic-session');
    expect(await secureStorage.getItem(key)).toBe('short-synthetic-session');
    expect([...state.data.keys()]).toEqual([key]);
    await secureStorage.removeItem(key);
    expect(state.data.size).toBe(0);
  });
  it('removes obsolete tail chunks when a session shrinks but stays chunked', async () => {
    await secureStorage.setItem(key, 's'.repeat(7300));
    await secureStorage.setItem(key, 'n'.repeat(2000));
    expect(await secureStorage.getItem(key)).toBe('n'.repeat(2000));
    expect([...state.data.keys()].sort()).toEqual([`${key}.0`, `${key}.1`, `${key}.n`]);
    await secureStorage.removeItem(key);
    expect(state.data.size).toBe(0);
  });
  it('cleans contiguous historical chunks after the old client lost their count', async () => {
    state.data.set(key, 'current-synthetic-session');
    state.data.set(`${key}.0`, 'old-synthetic-part-0');
    state.data.set(`${key}.1`, 'old-synthetic-part-1');
    await secureStorage.removeItem(key);
    expect(state.data.size).toBe(0);
  });
  it('serializes refresh writes before removal so the session cannot be reconstructed', async () => {
    await Promise.all([secureStorage.setItem(key, 's'.repeat(4000)), secureStorage.setItem(key, 's'.repeat(2000)), secureStorage.removeItem(key)]);
    expect(await secureStorage.getItem(key)).toBeNull();
    expect(state.data.size).toBe(0);
  });
  it('retains cleanup metadata on partial deletion and never reads a partial session', async () => {
    await secureStorage.setItem(key, 's'.repeat(4000));
    state.remove.mockImplementationOnce(async (entry: string) => { state.data.delete(entry); })
      .mockRejectedValueOnce(new Error('Synthetic secure storage failure'));
    await expect(secureStorage.setItem(key, 'short')).rejects.toThrow('Synthetic secure storage failure');
    expect(state.data.get(`${key}.n`)).toBe('3');
    expect(await secureStorage.getItem(key)).toBeNull();
    await secureStorage.removeItem(key);
    expect(state.data.size).toBe(0);
  });
});
