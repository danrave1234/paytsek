import type { CreateRecordRequest, SyncStatus } from '@paytsek/contracts';
import { LOCAL_DRAFT_CAP } from '@paytsek/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { newId } from './device';
import { assertScopeCurrent, requireRequestScope, ScopeChangedError, type RequestScope } from './request-scope';

export interface Draft {
  clientRecordId: string;
  workspaceId: string;
  userId: string;
  imageUri: string | null;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
  request: CreateRecordRequest;
  syncStatus: SyncStatus;
  proofId: string | null;
  lastError: string | null;
  quotaBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  serverRecordId: string | null;
}
export type DraftAttempt = { draft: Draft; id: string; scope: RequestScope };
export const UPLOAD_LEASE_MS = 120_000;
const processId = newId();
const MIGRATIONS = [
  `create table if not exists drafts (
    client_record_id text primary key, workspace_id text not null, image_uri text,
    content_type text not null, request_json text not null, sync_status text not null,
    proof_id text, last_error text, quota_blocked integer not null default 0,
    created_at text not null, updated_at text not null, server_record_id text
  ); create index if not exists drafts_ws_idx on drafts(workspace_id, sync_status);`,
  `alter table drafts add column user_id text;
   alter table drafts add column attempt_id text;
   alter table drafts add column attempt_owner text;
   alter table drafts add column lease_until integer;
   create index drafts_account_idx on drafts(user_id, workspace_id, sync_status);`,
];
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initialize(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('paytsek.db', { useNewConnection: true });
  await db.execAsync('pragma journal_mode = wal;');
  let version = (await db.getFirstAsync<{ user_version: number }>('pragma user_version'))?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[next - 1]!);
      await db.execAsync(`pragma user_version = ${next}`);
    });
    version = next;
  }
  // Only this JS process uploads proofs. An old process cannot retain ownership
  // across restart; clearing its attempt token fences any delayed completion.
  await db.runAsync(`update drafts set sync_status = case when proof_id is null then 'LOCAL_DRAFT' else 'PARTIAL_UPLOAD' end,
    attempt_id = null, attempt_owner = null, lease_until = null
    where sync_status = 'UPLOADING' and (attempt_owner is null or attempt_owner <> ?)`, [processId]);
  await db.getFirstAsync('select 1 as ready');
  return db;
}
async function open() {
  if (!dbPromise) dbPromise = initialize().catch((error) => { dbPromise = null; throw error; });
  return dbPromise;
}
function scopeFor(workspaceId: string): RequestScope {
  const scope = requireRequestScope();
  if (scope.workspaceId !== workspaceId) throw new ScopeChangedError();
  return scope;
}
async function recoverExpired(db: SQLite.SQLiteDatabase, scope: RequestScope) {
  assertScopeCurrent(scope);
  await db.runAsync(`update drafts set sync_status = case when proof_id is null then 'LOCAL_DRAFT' else 'PARTIAL_UPLOAD' end,
    attempt_id = null, attempt_owner = null, lease_until = null
    where user_id = ? and workspace_id = ? and sync_status = 'UPLOADING' and (lease_until is null or lease_until <= ?)`,
  [scope.userId, scope.workspaceId, Date.now()]);
}
function rowToDraft(row: Record<string, unknown>): Draft {
  return {
    clientRecordId: String(row.client_record_id), workspaceId: String(row.workspace_id), userId: String(row.user_id),
    imageUri: row.image_uri as string | null, contentType: row.content_type as Draft['contentType'],
    request: JSON.parse(String(row.request_json)) as CreateRecordRequest, syncStatus: row.sync_status as SyncStatus,
    proofId: row.proof_id as string | null, lastError: row.last_error as string | null,
    quotaBlocked: Number(row.quota_blocked) === 1, createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    serverRecordId: row.server_record_id as string | null,
  };
}

/** Capture bytes are durable before SQLite acknowledges a saved scan. */
export async function stageImage(sourceUri: string, clientRecordId: string, ext: string): Promise<string> {
  const dir = new Directory(Paths.document, 'proofs');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${clientRecordId}.${ext}`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

type NewDraft = Pick<Draft, 'clientRecordId' | 'workspaceId' | 'userId' | 'imageUri' | 'contentType' | 'request'>;
export async function saveDraft(draft: NewDraft): Promise<Draft> {
  const scope = scopeFor(draft.workspaceId);
  if (scope.userId !== draft.userId) throw new ScopeChangedError();
  const db = await open();
  assertScopeCurrent(scope);
  const pending = await db.getFirstAsync<{ n: number }>(`select count(*) as n from drafts where user_id = ? and workspace_id = ? and sync_status <> 'SYNCED'`, [scope.userId, draft.workspaceId]);
  if ((pending?.n ?? 0) >= LOCAL_DRAFT_CAP) throw new Error('This phone has many scans waiting to sync. Reconnect, then try again.');
  assertScopeCurrent(scope);
  const now = new Date().toISOString();
  await db.runAsync(`insert into drafts (client_record_id,workspace_id,user_id,image_uri,content_type,request_json,sync_status,created_at,updated_at)
    values (?,?,?,?,?,?,'LOCAL_DRAFT',?,?)`, [draft.clientRecordId, draft.workspaceId, draft.userId, draft.imageUri, draft.contentType, JSON.stringify(draft.request), now, now]);
  return { ...draft, syncStatus: 'LOCAL_DRAFT', proofId: null, lastError: null, quotaBlocked: false, createdAt: now, updatedAt: now, serverRecordId: null };
}

export async function listDrafts(workspaceId: string, pendingOnly = false): Promise<Draft[]> {
  const scope = scopeFor(workspaceId);
  const db = await open();
  await recoverExpired(db, scope);
  const rows = await db.getAllAsync<Record<string, unknown>>(`select * from drafts where user_id = ? and workspace_id = ? ${pendingOnly ? "and sync_status <> 'SYNCED'" : ''} order by created_at desc`, [scope.userId, workspaceId]);
  assertScopeCurrent(scope);
  return rows.map(rowToDraft);
}
export async function getDraft(workspaceId: string, clientRecordId: string): Promise<Draft | null> {
  const scope = scopeFor(workspaceId);
  const db = await open();
  await recoverExpired(db, scope);
  const row = await db.getFirstAsync<Record<string, unknown>>('select * from drafts where user_id = ? and workspace_id = ? and client_record_id = ?', [scope.userId, workspaceId, clientRecordId]);
  assertScopeCurrent(scope);
  return row ? rowToDraft(row) : null;
}

export async function correctDraft(workspaceId: string, clientRecordId: string, correction: Pick<CreateRecordRequest['corrected'], 'amountCentavos' | 'receiptProvider'>): Promise<Draft> {
  const scope = scopeFor(workspaceId);
  const current = await getDraft(workspaceId, clientRecordId);
  if (!current) throw new Error('This local record is no longer available.');
  if (current.syncStatus === 'SYNCED' || current.syncStatus === 'UPLOADING') throw new Error('Wait for sync to finish before editing this record.');
  const request = { ...current.request, corrected: { ...current.request.corrected, ...correction }, editedFields: [...new Set([...current.request.editedFields, ...Object.keys(correction)])] };
  const db = await open();
  assertScopeCurrent(scope);
  const result = await db.runAsync(`update drafts set request_json = ?, sync_status = case when proof_id is null then 'LOCAL_DRAFT' else 'PARTIAL_UPLOAD' end, last_error = null, updated_at = ?
    where user_id = ? and workspace_id = ? and client_record_id = ? and sync_status not in ('SYNCED','UPLOADING')`,
  [JSON.stringify(request), new Date().toISOString(), scope.userId, workspaceId, clientRecordId]);
  if (result.changes !== 1) throw new Error('The record changed while it was being edited. Try again.');
  return (await getDraft(workspaceId, clientRecordId))!;
}

/** Claim then read fresh data, so a correction made before the claim is retained. */
export async function claimDraft(draft: Draft, scope: RequestScope): Promise<DraftAttempt | null> {
  assertScopeCurrent(scope);
  if (draft.userId !== scope.userId || draft.workspaceId !== scope.workspaceId) throw new ScopeChangedError();
  const db = await open();
  assertScopeCurrent(scope);
  const id = newId();
  const now = Date.now();
  const result = await db.runAsync(`update drafts set sync_status = 'UPLOADING', attempt_id = ?, attempt_owner = ?, lease_until = ?, last_error = null, updated_at = ?
    where user_id = ? and workspace_id = ? and client_record_id = ? and sync_status <> 'SYNCED'
      and (sync_status <> 'UPLOADING' or lease_until is null or lease_until <= ?)`,
  [id, processId, now + UPLOAD_LEASE_MS, new Date(now).toISOString(), scope.userId, draft.workspaceId, draft.clientRecordId, now]);
  if (result.changes !== 1) return null;
  const row = await db.getFirstAsync<Record<string, unknown>>('select * from drafts where client_record_id = ? and attempt_id = ?', [draft.clientRecordId, id]);
  return row ? { draft: rowToDraft(row), id, scope } : null;
}

/** Every update is fenced by the unique attempt, including error and completion. */
export async function updateAttempt(attempt: DraftAttempt, patch: Partial<Pick<Draft, 'syncStatus' | 'proofId' | 'lastError' | 'serverRecordId'>> = {}): Promise<boolean> {
  const db = await open();
  const terminal = patch.syncStatus && patch.syncStatus !== 'UPLOADING';
  const fields = ['updated_at = ?', 'lease_until = ?'];
  const values: SQLite.SQLiteBindValue[] = [new Date().toISOString(), terminal ? null : Date.now() + UPLOAD_LEASE_MS];
  for (const [key, column] of [['syncStatus', 'sync_status'], ['proofId', 'proof_id'], ['lastError', 'last_error'], ['serverRecordId', 'server_record_id']] as const) {
    if (patch[key] !== undefined) { fields.push(`${column} = ?`); values.push(patch[key]!); }
  }
  if (terminal) fields.push('attempt_id = null', 'attempt_owner = null', 'quota_blocked = 0');
  values.push(attempt.draft.clientRecordId, attempt.scope.userId, attempt.draft.workspaceId, attempt.id);
  const result = await db.runAsync(`update drafts set ${fields.join(', ')} where client_record_id = ? and user_id = ? and workspace_id = ? and attempt_id = ? and sync_status = 'UPLOADING'`, values);
  return result.changes === 1;
}

export async function countLegacyDrafts(workspaceId: string): Promise<number> {
  const scope = scopeFor(workspaceId);
  const row = await (await open()).getFirstAsync<{ n: number }>("select count(*) as n from drafts where workspace_id = ? and user_id is null and sync_status <> 'SYNCED'", [workspaceId]);
  assertScopeCurrent(scope);
  return row?.n ?? 0;
}
/** Only called after explicit owner recovery and fresh server authorization. */
export async function bindLegacyDrafts(scope: RequestScope): Promise<number> {
  const db = await open();
  assertScopeCurrent(scope);
  const result = await db.runAsync("update drafts set user_id = ? where workspace_id = ? and user_id is null and sync_status <> 'SYNCED'", [scope.userId, scope.workspaceId]);
  return result.changes;
}

export async function pruneSynced(workspaceId: string): Promise<void> {
  const scope = scopeFor(workspaceId);
  const db = await open();
  const rows = await db.getAllAsync<{ client_record_id: string; image_uri: string | null }>("select client_record_id,image_uri from drafts where user_id = ? and workspace_id = ? and sync_status = 'SYNCED'", [scope.userId, workspaceId]);
  for (const row of rows) {
    assertScopeCurrent(scope);
    // The durable server record was acknowledged before the redundant file is removed.
    if (row.image_uri) { try { new File(row.image_uri).delete(); } catch { /* Already removed. */ } }
    await db.runAsync("delete from drafts where user_id = ? and workspace_id = ? and client_record_id = ? and sync_status = 'SYNCED'", [scope.userId, workspaceId, row.client_record_id]);
  }
}
