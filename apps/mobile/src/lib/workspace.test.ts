import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearWorkspaceCache, readWorkspaceCache, writeWorkspaceCache } from './workspace';
import { TEST_USER, TEST_WORKSPACE } from './test-fixtures';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { storage.set(key, value); },
  deleteItemAsync: async (key: string) => { storage.delete(key); },
}));
const workspace = { id: TEST_WORKSPACE, name: 'Synthetic workspace', timezone: 'Asia/Manila', role: 'OWNER' as const, isDemo: false, createdAt: '2026-10-04T02:00:00.000Z' };
beforeEach(() => storage.clear());

describe('offline workspace metadata', () => {
  it('restores enough context for offline capture without storing a session token', async () => {
    await writeWorkspaceCache(TEST_USER, [workspace], workspace.id);
    expect(await readWorkspaceCache(TEST_USER)).toEqual({ workspaces: [workspace], activeId: workspace.id });
    expect([...storage.values()].join('')).not.toMatch(/access_token|refresh_token/);
  });
  it('does not expose one account workspace metadata to another account', async () => {
    await writeWorkspaceCache(TEST_USER, [workspace], workspace.id);
    expect(await readWorkspaceCache('other-user')).toEqual({ workspaces: [], activeId: null });
  });
  it('serializes sign-out after a pending write so old promises cannot resurrect metadata', async () => {
    const write = writeWorkspaceCache(TEST_USER, [workspace], workspace.id);
    const clear = clearWorkspaceCache(TEST_USER);
    await Promise.all([write, clear]);
    expect(await readWorkspaceCache(TEST_USER)).toEqual({ workspaces: [], activeId: null });
  });
  it('drops revoked workspaces when a verified membership list replaces the cache', async () => {
    await writeWorkspaceCache(TEST_USER, [workspace], workspace.id);
    await writeWorkspaceCache(TEST_USER, [], null);
    expect(await readWorkspaceCache(TEST_USER)).toEqual({ workspaces: [], activeId: null });
  });
});
