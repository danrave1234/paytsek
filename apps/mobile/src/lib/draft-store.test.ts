import type { DatabaseSync as DatabaseType } from 'node:sqlite';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { draftFixture, TEST_USER, TEST_WORKSPACE } from './test-fixtures';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const state = vi.hoisted(() => ({ db: null as DatabaseType | null, deleted: [] as string[] }));
vi.mock('./device', () => ({ newId: () => randomUUID() }));
vi.mock('expo-file-system', () => ({
  Paths: { document: 'file:///test/' }, Directory: class {},
  File: class { constructor(private uri: string) {} delete() { state.deleted.push(this.uri); } },
}));
vi.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => ({
  execAsync: async (sql: string) => { state.db!.exec(sql); },
  getFirstAsync: async (sql: string, args: unknown[] = []) => state.db!.prepare(sql).get(...args as never[]),
  getAllAsync: async (sql: string, args: unknown[] = []) => state.db!.prepare(sql).all(...args as never[]),
  runAsync: async (sql: string, args: unknown[] = []) => ({ changes: Number(state.db!.prepare(sql).run(...args as never[]).changes) }),
  withTransactionAsync: async (work: () => Promise<void>) => {
    state.db!.exec('begin');
    try { await work(); state.db!.exec('commit'); } catch (error) { state.db!.exec('rollback'); throw error; }
  },
}) }));

async function modules() {
  const store = await import('./draft-store');
  const scope = await import('./request-scope');
  scope.setRequestScope(TEST_USER, TEST_WORKSPACE);
  return { store, scope };
}
beforeEach(() => { vi.resetModules(); state.db = new DatabaseSync(':memory:'); state.deleted = []; });
afterEach(() => { state.db?.close(); vi.useRealTimers(); });

describe('durable draft SQL ownership', () => {
  it('recovers interrupted upload after process restart without changing id or deleting proof', async () => {
    let { store, scope } = await modules();
    const draft = await store.saveDraft(draftFixture());
    const claim = await store.claimDraft(draft, scope.requireRequestScope());
    expect(claim).not.toBeNull();
    vi.resetModules();
    ({ store, scope } = await modules());
    const recovered = await store.getDraft(TEST_WORKSPACE, draft.clientRecordId);
    expect(recovered?.syncStatus).toBe('LOCAL_DRAFT');
    expect(recovered?.imageUri).toBe(draft.imageUri);
    expect((await store.claimDraft(recovered!, scope.requireRequestScope()))?.id).not.toBe(claim?.id);
    expect(state.deleted).toEqual([]);
  });

  it('fences the old attempt after expiry and takeover, including old failure callbacks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T02:00:00Z'));
    const { store, scope } = await modules();
    const draft = await store.saveDraft(draftFixture());
    const first = await store.claimDraft(draft, scope.requireRequestScope());
    expect(await store.claimDraft(draft, scope.requireRequestScope())).toBeNull();
    vi.setSystemTime(Date.now() + store.UPLOAD_LEASE_MS + 1);
    const next = await store.claimDraft(draft, scope.requireRequestScope());
    expect(next).not.toBeNull();
    expect(await store.updateAttempt(first!, { syncStatus: 'FAILED', lastError: 'old completion' })).toBe(false);
    expect(await store.updateAttempt(first!, { syncStatus: 'SYNCED', serverRecordId: 'old-record' })).toBe(false);
    expect(await store.updateAttempt(next!, { syncStatus: 'SYNCED', serverRecordId: 'new-record' })).toBe(true);
    expect((await store.getDraft(TEST_WORKSPACE, draft.clientRecordId))?.serverRecordId).toBe('new-record');
  });

  it('claims current edited values instead of the stale caller object', async () => {
    const { store, scope } = await modules();
    const stale = await store.saveDraft(draftFixture());
    await store.correctDraft(TEST_WORKSPACE, stale.clientRecordId, { amountCentavos: 12500, receiptProvider: null });
    const attempt = await store.claimDraft(stale, scope.requireRequestScope());
    expect(attempt?.draft.request.corrected.amountCentavos).toBe(12500);
  });

  it('never exposes or claims another signed-in account’s drafts in a shared workspace', async () => {
    const { store, scope } = await modules();
    const own = await store.saveDraft(draftFixture());
    scope.setRequestScope('55555555-5555-4555-8555-555555555555', TEST_WORKSPACE);
    expect(await store.listDrafts(TEST_WORKSPACE)).toEqual([]);
    expect(await store.getDraft(TEST_WORKSPACE, own.clientRecordId)).toBeNull();
    await expect(store.claimDraft(own, scope.requireRequestScope())).rejects.toThrow('account or workspace changed');
    await store.pruneSynced(TEST_WORKSPACE);
    expect(state.deleted).toEqual([]);
  });

  it('preserves unknown-owner legacy scans until an explicit authorized recovery', async () => {
    const { store, scope } = await modules();
    const draft = await store.saveDraft(draftFixture());
    state.db!.prepare('update drafts set user_id = null where client_record_id = ?').run(draft.clientRecordId);
    expect(await store.listDrafts(TEST_WORKSPACE)).toEqual([]);
    expect(await store.countLegacyDrafts(TEST_WORKSPACE)).toBe(1);
    await store.pruneSynced(TEST_WORKSPACE);
    expect(state.deleted).toEqual([]);
    expect(await store.bindLegacyDrafts(scope.requireRequestScope())).toBe(1);
    expect((await store.listDrafts(TEST_WORKSPACE))[0]?.userId).toBe(TEST_USER);
  });

  it('prunes only acknowledged records for the active account', async () => {
    const { store, scope } = await modules();
    const draft = await store.saveDraft(draftFixture());
    await store.pruneSynced(TEST_WORKSPACE);
    expect(state.deleted).toEqual([]);
    const claim = await store.claimDraft(draft, scope.requireRequestScope());
    await store.updateAttempt(claim!, { syncStatus: 'SYNCED', serverRecordId: 'server-id' });
    await store.pruneSynced(TEST_WORKSPACE);
    expect(state.deleted).toEqual([draft.imageUri]);
    expect(await store.getDraft(TEST_WORKSPACE, draft.clientRecordId)).toBeNull();
  });
});
