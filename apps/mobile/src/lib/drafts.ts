import type { CreateRecordRequest, CreateRecordResponse, InitProofUploadResponse, SyncStatus } from '@paytsek/contracts';
import { LOCAL_DRAFT_CAP } from '@paytsek/contracts';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { ApiError, OfflineError, api } from './api';
import { sha256Hex } from './device';
import { PaymentCollector, type PendingNotificationEvent } from 'payment-collector';

/** A cached notification event from the native collector (matching fields only). */
export interface CachedNotification {
  clientEventId: string;
  provider: string;
  amountCentavos: number;
  postedAt: string;
  providerDescribedAt: string | null;
  capturedAt: string;
  matchedAt: string | null;
}

/** A local match between a proof and a cached notification. */
export interface LocalMatch {
  clientEventId: string;
  provider: string;
  amountCentavos: number;
  eventAt: string;
  /** Time delta in seconds between proof capture and notification. */
  deltaSeconds: number;
}

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

const SCHEMA = `
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
  create table if not exists cached_notifications (
    client_event_id text primary key,
    provider text not null,
    amount_centavos integer not null,
    posted_at text not null,
    provider_described_at text,
    captured_at text not null,
    matched_at text
  );
  create index if not exists cached_notifs_amount_idx on cached_notifications(amount_centavos) where matched_at is null;
`;

/** Ordered, append-only migrations; `pragma user_version` records the last one applied. */
const MIGRATIONS = [SCHEMA];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initialize(): Promise<SQLite.SQLiteDatabase> {
  // Expo SQLite 57 on Android can retain a poisoned cached native handle when
  // the JS runtime is recreated while PayTsek's notification service keeps the
  // process alive. A distinct connection avoids that cache; the promise below
  // also prevents concurrent callers from creating duplicate wrappers.
  const connection = await SQLite.openDatabaseAsync('paytsek.db', { useNewConnection: true });
  await connection.execAsync('pragma journal_mode = wal;');
  const versionRow = await connection.getFirstAsync<{ user_version: number }>('pragma user_version');
  let version = versionRow?.user_version ?? 0;
  // Existing installs stamped 0 re-run the idempotent v1 schema once, then advance.
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await connection.withTransactionAsync(async () => {
      await connection.execAsync(MIGRATIONS[next - 1]!);
      await connection.execAsync(`pragma user_version = ${next}`);
    });
    version = next;
  }
  // execAsync may resolve against the affected dead handle. Force one prepared
  // statement now so a bad connection never reaches the proof-saving path.
  await connection.getFirstAsync<{ ready: number }>('select 1 as ready');
  return connection;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = initialize().catch((error) => {
      // Do not pin a failed initialization for the rest of the app session.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
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

async function countDrafts(workspaceId: string): Promise<number> {
  const d = await open();
  const r = await d.getFirstAsync<{ n: number }>(`select count(*) as n from drafts where workspace_id = ? and sync_status <> 'SYNCED'`, [workspaceId]);
  return r?.n ?? 0;
}

export async function saveDraft(draft: Omit<Draft, 'syncStatus' | 'proofId' | 'lastError' | 'quotaBlocked' | 'createdAt' | 'updatedAt' | 'serverRecordId'>): Promise<Draft> {
  const d = await open();
  const pending = await countDrafts(draft.workspaceId);
  if (pending >= LOCAL_DRAFT_CAP) throw new Error(`This phone has ${LOCAL_DRAFT_CAP} scans waiting to sync. Reconnect, then try again.`);
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

export async function getDraft(workspaceId: string, clientRecordId: string): Promise<Draft | null> {
  const d = await open();
  const row = await d.getFirstAsync<Record<string, unknown>>(
    `select * from drafts where workspace_id = ? and client_record_id = ?`,
    [workspaceId, clientRecordId],
  );
  return row ? rowToDraft(row) : null;
}

/** Correct unsynced proof fields without losing the retained image or stable id. */
export async function correctDraft(
  workspaceId: string,
  clientRecordId: string,
  correction: Pick<CreateRecordRequest['corrected'], 'amountCentavos' | 'receiptProvider'>,
): Promise<Draft> {
  const current = await getDraft(workspaceId, clientRecordId);
  if (!current) throw new Error('This local record is no longer available.');
  if (current.syncStatus === 'SYNCED') throw new Error('This record has already synced. Open the server record instead.');
  if (current.syncStatus === 'UPLOADING') throw new Error('Wait for the current sync attempt to finish.');
  const request: CreateRecordRequest = {
    ...current.request,
    corrected: { ...current.request.corrected, ...correction },
    editedFields: [...new Set([...current.request.editedFields, ...Object.keys(correction)])],
  };
  const d = await open();
  const result = await d.runAsync(
    `update drafts
        set request_json = ?, sync_status = case when proof_id is null then 'LOCAL_DRAFT' else 'PARTIAL_UPLOAD' end,
            last_error = null, updated_at = ?
      where workspace_id = ? and client_record_id = ? and sync_status not in ('SYNCED','UPLOADING')`,
    [JSON.stringify(request), new Date().toISOString(), workspaceId, clientRecordId],
  );
  if (result.changes !== 1) throw new Error('The record changed while it was being edited. Try again.');
  return (await getDraft(workspaceId, clientRecordId))!;
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

async function update(id: string, patch: Partial<Pick<Draft, 'syncStatus' | 'proofId' | 'lastError' | 'quotaBlocked' | 'serverRecordId'>>, onlyWhileUploading = false): Promise<number> {
  const d = await open();
  const sets: string[] = ['updated_at = ?'];
  const vals: unknown[] = [new Date().toISOString()];
  if (patch.syncStatus !== undefined) { sets.push('sync_status = ?'); vals.push(patch.syncStatus); }
  if (patch.proofId !== undefined) { sets.push('proof_id = ?'); vals.push(patch.proofId); }
  if (patch.lastError !== undefined) { sets.push('last_error = ?'); vals.push(patch.lastError); }
  if (patch.quotaBlocked !== undefined) { sets.push('quota_blocked = ?'); vals.push(patch.quotaBlocked ? 1 : 0); }
  if (patch.serverRecordId !== undefined) { sets.push('server_record_id = ?'); vals.push(patch.serverRecordId); }
  vals.push(id);
  const result = await d.runAsync(`update drafts set ${sets.join(', ')} where client_record_id = ?${onlyWhileUploading ? " and sync_status = 'UPLOADING'" : ''}`, vals as SQLite.SQLiteBindValue[]);
  return result.changes;
}

/** Claim a draft for upload. Returns false when another sync attempt owns it or it already synced. */
async function claimForUpload(id: string): Promise<boolean> {
  const d = await open();
  const result = await d.runAsync(
    `update drafts set sync_status = 'UPLOADING', last_error = null, updated_at = ?
      where client_record_id = ? and sync_status not in ('UPLOADING','SYNCED')`,
    [new Date().toISOString(), id],
  );
  return result.changes === 1;
}

/** Sync one draft. Returns the resulting sync status. Safe to call repeatedly. */
export async function syncDraft(draft: Draft): Promise<SyncStatus> {
  let proofId = draft.proofId;
  // Only one attempt may own the upload pipeline at a time; a concurrent call
  // returns the current status instead of double-running init/PUT/create.
  if (!(await claimForUpload(draft.clientRecordId))) {
    const current = await getDraft(draft.workspaceId, draft.clientRecordId);
    return current?.syncStatus ?? draft.syncStatus;
  }
  try {
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
      // Persist the proofId but keep the UPLOADING claim until this attempt ends.
      await update(draft.clientRecordId, { proofId }, true);
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
      // Use the freshest proofId: the image may have uploaded successfully in
      // this very attempt before the record call went offline.
      await update(draft.clientRecordId, { syncStatus: proofId ? 'PARTIAL_UPLOAD' : 'LOCAL_DRAFT', lastError: e.message }, true);
      return proofId ? 'PARTIAL_UPLOAD' : 'LOCAL_DRAFT';
    }
    await update(draft.clientRecordId, { syncStatus: 'FAILED', lastError: (e as Error).message }, true);
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
    if (s === 'LOCAL_DRAFT' && d.quotaBlocked) break; // Legacy server state; beta UI never exposes quotas.
  }
  return { synced, pending: drafts.length - synced };
}

/** Remove synced drafts and their staged images (evidence now lives on the server). */
export async function pruneSynced(workspaceId: string): Promise<void> {
  const d = await open();
  const rows = await d.getAllAsync<{ image_uri: string | null }>(`select image_uri from drafts where workspace_id = ? and sync_status = 'SYNCED'`, [workspaceId]);
  for (const r of rows) {
    if (r.image_uri) {
      try { new File(r.image_uri).delete(); } catch { /* already gone */ }
    }
  }
  await d.runAsync(`delete from drafts where workspace_id = ? and sync_status = 'SYNCED'`, [workspaceId]);
}

/** Pull pending notifications from the native collector and cache them locally. */
export async function syncCachedNotifications(): Promise<number> {
  if (!PaymentCollector.isSupported()) return 0;
  const pending = await PaymentCollector.getPendingNotifications();
  if (pending.length === 0) return 0;
  const d = await open();
  let inserted = 0;
  for (const ev of pending) {
    const result = await d.runAsync(
      `insert or ignore into cached_notifications (client_event_id, provider, amount_centavos, posted_at, provider_described_at, captured_at)
       values (?, ?, ?, ?, ?, ?)`,
      [ev.clientEventId, ev.provider, ev.amountCentavos, ev.postedAt, ev.providerDescribedAt ?? null, ev.capturedAt],
    );
    if (result.changes > 0) inserted += 1;
  }
  return inserted;
}

/**
 * Find local notification candidates that match a proof by amount and time.
 * Uses the same windows as the server matcher: 5 min on receipt time,
 * 15 min on capture time fallback.
 */
export async function findLocalMatches(amountCentavos: number, provider: string | null, capturedAt: string, receiptTransactionAt: string | null): Promise<LocalMatch[]> {
  const d = await open();
  // Get unmatched notifications with the same amount
  const rows = await d.getAllAsync<{
    client_event_id: string;
    provider: string;
    amount_centavos: number;
    posted_at: string;
    provider_described_at: string | null;
    captured_at: string;
  }>(`select client_event_id, provider, amount_centavos, posted_at, provider_described_at, captured_at
       from cached_notifications
       where amount_centavos = ? and matched_at is null
       order by captured_at`,
    [amountCentavos],
  );

  if (rows.length === 0) return [];

  // Use receipt time if available, otherwise capture time
  const proofTime = receiptTransactionAt ? new Date(receiptTransactionAt).getTime() : new Date(capturedAt).getTime();
  const windowMs = receiptTransactionAt ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 min or 15 min

  const matches: LocalMatch[] = [];
  for (const row of rows) {
    // Use provider-described time if available, else captured_at
    const eventTime = row.provider_described_at
      ? new Date(row.provider_described_at).getTime()
      : new Date(row.captured_at).getTime();
    const deltaMs = Math.abs(eventTime - proofTime);
    if (deltaMs <= windowMs) {
      matches.push({
        clientEventId: row.client_event_id,
        provider: row.provider,
        amountCentavos: row.amount_centavos,
        eventAt: row.provider_described_at ?? row.captured_at,
        deltaSeconds: Math.round(deltaMs / 1000),
      });
    }
  }

  // Mark the best match (smallest delta) as matched
  if (matches.length > 0) {
    matches.sort((a, b) => a.deltaSeconds - b.deltaSeconds);
    const best = matches[0]!;
    await d.runAsync(
      `update cached_notifications set matched_at = ? where client_event_id = ?`,
      [new Date().toISOString(), best.clientEventId],
    );
  }

  return matches;
}

/** Get cached notifications that haven't been matched yet (for diagnostics). */
export async function listUnmatchedNotifications(): Promise<CachedNotification[]> {
  const d = await open();
  const rows = await d.getAllAsync<{
    client_event_id: string;
    provider: string;
    amount_centavos: number;
    posted_at: string;
    provider_described_at: string | null;
    captured_at: string;
    matched_at: string | null;
  }>(`select client_event_id, provider, amount_centavos, posted_at, provider_described_at, captured_at, matched_at
       from cached_notifications
       where matched_at is null
       order by captured_at desc
       limit 50`);
  return rows.map((r) => ({
    clientEventId: r.client_event_id,
    provider: r.provider,
    amountCentavos: r.amount_centavos,
    postedAt: r.posted_at,
    providerDescribedAt: r.provider_described_at,
    capturedAt: r.captured_at,
    matchedAt: r.matched_at,
  }));
}

/** Clean up old cached notifications older than 3 days. */
export async function pruneCachedNotifications(): Promise<void> {
  const d = await open();
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await d.runAsync(`delete from cached_notifications where captured_at < ?`, [cutoff]);
}
