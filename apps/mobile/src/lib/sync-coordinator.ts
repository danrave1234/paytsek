import type { WorkspaceSummary } from '@paytsek/contracts';
import { onlineManager } from '@tanstack/react-query';
import { pruneSynced, syncAll } from './drafts';
import { applySyncedRecord, invalidateDrafts, queryClient } from './queries';
import { assertScopeCurrent, isScopeCurrent, requireRequestScope } from './request-scope';

export type SyncProgress = { syncing: boolean; lastSyncedAt: string | null };
export const SYNC_PROGRESS_KEY = ['sync-progress'] as const;
export const EMPTY_SYNC_PROGRESS: SyncProgress = { syncing: false, lastSyncedAt: null };
const running = new Map<number, Promise<void>>();

/** One foreground drain per immutable account/workspace generation. */
export function syncWorkspace(workspace: Pick<WorkspaceSummary, 'id' | 'timezone'>): Promise<void> {
  const scope = requireRequestScope();
  assertScopeCurrent(scope);
  if (scope.workspaceId !== workspace.id || !onlineManager.isOnline()) return Promise.resolve();
  const existing = running.get(scope.generation);
  if (existing) return existing;
  const promise = (async () => {
    const previous = queryClient.getQueryData<SyncProgress>(SYNC_PROGRESS_KEY) ?? EMPTY_SYNC_PROGRESS;
    queryClient.setQueryData<SyncProgress>(SYNC_PROGRESS_KEY, { ...previous, syncing: true });
    try {
      const result = await syncAll(workspace.id);
      if (!isScopeCurrent(scope)) return;
      for (const record of result.records) applySyncedRecord(record, workspace.timezone, scope);
      if (result.synced) {
        await Promise.all(['records', 'home', 'inbox', 'analytics'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      }
      if (!isScopeCurrent(scope)) return;
      await pruneSynced(workspace.id);
      if (!isScopeCurrent(scope)) return;
      queryClient.setQueryData<SyncProgress>(SYNC_PROGRESS_KEY, { syncing: false, lastSyncedAt: result.synced ? new Date().toISOString() : previous.lastSyncedAt });
    } finally {
      running.delete(scope.generation);
      if (isScopeCurrent(scope)) {
        queryClient.setQueryData<SyncProgress>(SYNC_PROGRESS_KEY, (state) => ({ ...(state ?? previous), syncing: false }));
        void invalidateDrafts();
      }
    }
  })();
  running.set(scope.generation, promise);
  return promise;
}
