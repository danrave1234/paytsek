import { WorkspaceSummary } from '@paytsek/contracts';
import * as SecureStore from 'expo-secure-store';

const activeKey = (userId: string) => `paytsek.workspace.v2.${userId}`;
const summaryKey = (userId: string, id: string) => `paytsek.workspace-summary.v1.${userId}.${id}`;
const indexKey = (userId: string) => `paytsek.workspace-index.v1.${userId}`;
let writes: Promise<unknown> = Promise.resolve();
function serializeWrite<T>(work: () => Promise<T>): Promise<T> {
  const next = writes.catch(() => undefined).then(work);
  writes = next;
  return next;
}

/** Metadata only, scoped to the signed-in account. Never grants server access. */
export async function readWorkspaceCache(userId: string): Promise<{ workspaces: WorkspaceSummary[]; activeId: string | null }> {
  const [raw, activeId] = await Promise.all([SecureStore.getItemAsync(indexKey(userId)), SecureStore.getItemAsync(activeKey(userId))]);
  let ids: string[] = [];
  try { const parsed: unknown = JSON.parse(raw ?? '[]'); if (Array.isArray(parsed)) ids = parsed.filter((id): id is string => typeof id === 'string').slice(0, 100); } catch { /* Corrupt metadata is expendable. */ }
  const workspaces: WorkspaceSummary[] = [];
  for (const id of ids) {
    try {
      const entry = WorkspaceSummary.safeParse(JSON.parse((await SecureStore.getItemAsync(summaryKey(userId, id))) ?? 'null'));
      if (entry.success && entry.data.id === id) workspaces.push(entry.data);
    } catch { /* Other valid workspace summaries remain available offline. */ }
  }
  return { workspaces, activeId: workspaces.some((w) => w.id === activeId) ? activeId : null };
}

export function writeWorkspaceCache(userId: string, workspaces: WorkspaceSummary[], activeId: string | null): Promise<void> {
  return serializeWrite(async () => {
  const previous = await readWorkspaceCache(userId);
  for (const workspace of workspaces) await SecureStore.setItemAsync(summaryKey(userId, workspace.id), JSON.stringify(workspace));
  await SecureStore.setItemAsync(indexKey(userId), JSON.stringify(workspaces.map((w) => w.id)));
  await writeActiveId(userId, activeId);
  for (const workspace of previous.workspaces) if (!workspaces.some((w) => w.id === workspace.id)) await SecureStore.deleteItemAsync(summaryKey(userId, workspace.id));
  });
}

async function writeActiveId(userId: string, id: string | null): Promise<void> {
  if (id) await SecureStore.setItemAsync(activeKey(userId), id);
  else await SecureStore.deleteItemAsync(activeKey(userId));
}
export function setActiveWorkspaceId(userId: string, id: string | null): Promise<void> {
  return serializeWrite(() => writeActiveId(userId, id));
}

/** Remove account metadata on explicit sign-out; proof files and SQLite remain. */
export function clearWorkspaceCache(userId: string): Promise<void> {
  return serializeWrite(async () => {
  const previous = await readWorkspaceCache(userId);
  for (const workspace of previous.workspaces) await SecureStore.deleteItemAsync(summaryKey(userId, workspace.id));
  await SecureStore.deleteItemAsync(indexKey(userId));
  await SecureStore.deleteItemAsync(activeKey(userId));
  });
}
