import type { CreateRecordRequest, CreateRecordResponse, InitProofUploadResponse, SyncStatus } from '@paytsek/contracts';
import { LOCAL_DRAFT_CAP } from '@paytsek/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { ApiError, OfflineError, api } from './api';
import { sha256Hex } from './device';

/**
 * Durable scanner-side draft queue. A scan is written here BEFORE any upload.
 * Sync order per draft: init proof -> PUT bytes -> finalize -> create record.
 * All ids are client-generated and stable, so retries/reboots never create a
 * second canonical record or usage charge. Sync status is separate from
 * evidence status: a queued draft is never shown as verified.
 */
export interface Draft {
  clientRecordId: string;
  workspaceId: string;
  imageUri: string | null;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
  request: CreateRecordRequest;
  syncStatus: SyncStatus;
  proofId: string | null;
  lastError: string | null;
  /** Set when the server rejected with QUOTA_EXHAUSTED: keep as a clearly labeled pending draft. */
  quotaBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  serverRecordId: string | null;
}

let db: SQLite.SQLiteDatabase | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('paytsek.db');
  await db.execAsync(`
    pragma journal_mode = wal;
    create table if not exists drafts (
      client_record_id text primary key,
      workspace_id text not null,
      image_uri text,
      content_type text not null,
      request_json text not null,
      sync_status text not null,
      proof_id text,
      last_error text,
      quota_blocked integer not null default 0,
      created_at text not null,
      updated_at text not null,
      server_record_id text
    );
    create index if not exists drafts_ws_idx on drafts(workspace_id, sync_status);
  `);
  return db;
}

const proofsDir = () => new Directory(Paths.document, 'proofs');

/** Copy the captured image into app-private storage so the evidence survives app restarts. */
export async function stageImage(sourceUri: string, clientRecordId: string, ext: string): Promise<string> {
  const dir = proofsDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${clientRecordId}.${ext}`);
  new File(sourceUri).copy(dest);
  return dest.uri;
}

export async function countDrafts(workspaceId: string): Promise<number> {
  const d = await open();
  const r = await d.getFirstAsync<{ n: number }>(`select count(*) as n from drafts where workspace_id = ? and sync_status <> 'SYNCED'`, [workspaceId]);
  return r?.n ?? 0;
}

export async function saveDraft(draft: Omit<Draft, 'syncStatus' | 'proofId' | 'lastError' | 'quotaBlocked' | 'createdAt' | 'updatedAt' | 'serverRecordId'>): Promise<Draft> {
  const d = await open();
  const pending = await countDrafts(draft.workspaceId);
  if (pending >= LOCAL_DRAFT_CAP) throw new Error(`Local draft limit (${LOCAL_DRAFT_CAP}) reached. Reconnect or upgrade to sync pending scans before adding more.`);
  const now = new Date().toISOString();
  const full: Draft = { ...draft, syncStatus: 'LOCAL_DRAFT', proofId: null, lastError: null, quotaBlocked: false, createdAt: now, updatedAt: now, serverRecordId: null };
  await d.runAsync(
    `insert or replace into drafts (client_record_id, workspace_id, image_uri, content_type, request_json, sync_status, proof_id, last_error, quota_blocked, created_at, updated_at, server_record_id)
     values (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [full.clientRecordId, full.workspaceId, full.imageUri, full.contentType, JSON.stringify(full.request), full.syncStatus, null, null, 0, now, now, null],
  );
  return full;
}

export async function listDrafts(workspaceId: string, pendingOnly = false): Promise<Draft[]> {
  const d = await open();
  const rows = await d.getAllAsync<Record<string, unknown>>(`select * from drafts where workspace_id = ? ${pendingOnly ? "and sync_status <> 'SYNCED'" : ''} order by created_at desc`, [workspaceId]);
  return rows.map(rowToDraft);
}

function rowToDraft(r: Record<string, unknown>): Draft {
  return {
    clientRecordId: String(r.client_record_id),
    workspaceId: String(r.workspace_id),
    imageUri: (r.image_uri as string | null) ?? null,
    contentType: r.content_type as Draft['contentType'],
    request: JSON.parse(String(r.request_json)) as CreateRecordRequest,
    syncStatus: r.sync_status as SyncStatus,
    proofId: (r.proof_id as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    quotaBlocked: Number(r.quota_blocked) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    serverRecordId: (r.server_record_id as string | null) ?? null,
  };
}

async function update(id: string, patch: Partial<Pick<Draft, 'syncStatus' | 'proofId' | 'lastError' | 'quotaBlocked' | 'serverRecordId'>>): Promise<void> {
  const d = await open();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [new Date().toISOString()];
  if (patch.syncStatus !== undefined) { sets.push('sync_status = ?'); vals.push(patch.syncStatus); }
  if (patch.proofId !== undefined) { sets.push('proof_id = ?'); vals.push(patch.proofId); }
  if (patch.lastError !== undefined) { sets.push('last_error = ?'); vals.push(patch.lastError); }
  if (patch.quotaBlocked !== undefined) { sets.push('quota_blocked = ?'); vals.push(patch.quotaBlocked ? 1 : 0); }
  if (patch.serverRecordId !== undefined) { sets.push('server_record_id = ?'); vals.push(patch.serverRecordId); }
  vals.push(id);
  await d.runAsync(`update drafts set ${sets.join(', ')} where client_record_id = ?`, vals as SQLite.SQLiteBindValue[]);
}

/** Sync one draft. Returns the resulting sync status. Safe to call repeatedly. */
export async function syncDraft(draft: Draft): Promise<SyncStatus> {
  try {
    await update(draft.clientRecordId, { syncStatus: 'UPLOADING', lastError: null });
    let proofId = draft.proofId;
    if (draft.imageUri && !proofId) {
      const file = new File(draft.imageUri);
      const bytes = await file.bytes();
      const sha256 = await sha256Hex(bytes);
      const init = await api<InitProofUploadResponse>('/v1/proofs/init', {
        method: 'POST',
        body: { clientProofId: draft.clientRecordId, contentType: draft.contentType, byteLength: bytes.byteLength, sha256, perceptualHash: null },
      });
      proofId = init.proofId;
      if (!init.alreadyStored && init.uploadUrl) {
        const put = await fetch(init.uploadUrl, { method: 'PUT', headers: { 'Content-Type': draft.contentType, ...init.uploadHeaders }, body: bytes });
        if (!put.ok) throw new Error(`Image upload failed (${put.status})`);
        await api('/v1/proofs/finalize', { method: 'POST', body: { proofId } });
      }
      await update(draft.clientRecordId, { proofId, syncStatus: 'PARTIAL_UPLOAD' });
    }
    const res = await api<CreateRecordResponse>('/v1/records', { method: 'POST', body: { ...draft.request, proofId } });
    await update(draft.clientRecordId, { syncStatus: 'SYNCED', serverRecordId: res.record.id, quotaBlocked: false });
    return 'SYNCED';
  } catch (e) {
    if (e instanceof ApiError && e.code === 'QUOTA_EXHAUSTED') {
      await update(draft.clientRecordId, { syncStatus: 'LOCAL_DRAFT', quotaBlocked: true, lastError: e.message });
      return 'LOCAL_DRAFT';
    }
    if (e instanceof OfflineError) {
      await update(draft.clientRecordId, { syncStatus: draft.proofId ? 'PARTIAL_UPLOAD' : 'LOCAL_DRAFT', lastError: e.message });
      return draft.proofId ? 'PARTIAL_UPLOAD' : 'LOCAL_DRAFT';
    }
    await update(draft.clientRecordId, { syncStatus: 'FAILED', lastError: (e as Error).message });
    return 'FAILED';
  }
}

/** Sync everything pending for a workspace (called on resume/reconnect and after quota changes). */
export async function syncAll(workspaceId: string): Promise<{ synced: number; pending: number }> {
  const drafts = await listDrafts(workspaceId, true);
  let synced = 0;
  for (const d of drafts) {
    const s = await syncDraft(d);
    if (s === 'SYNCED') synced += 1;
    if (s === 'LOCAL_DRAFT' && d.quotaBlocked) break; // no point continuing while quota is exhausted
  }
  return { synced, pending: drafts.length - synced };
}

/** Remove synced drafts and their staged images (evidence now lives on the server). */
export async function pruneSynced(workspaceId: string): Promise<void> {
  const d = await open();
  const rows = await d.getAllAsync<{ client_record_id: string; image_uri: string | null }>(`select client_record_id, image_uri from drafts where workspace_id = ? and sync_status = 'SYNCED'`, [workspaceId]);
  for (const r of rows) {
    if (r.image_uri) {
      try { new File(r.image_uri).delete(); } catch { /* already gone */ }
    }
    await d.runAsync(`delete from drafts where client_record_id = ? and workspace_id = ? and sync_status = 'SYNCED'`, [r.client_record_id, workspaceId]);
  }
}
