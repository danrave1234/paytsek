import type { CreateRecordResponse, InitProofUploadResponse, RecordSummary, SyncStatus, WorkspaceSummary } from '@paytsek/contracts';
import { File } from 'expo-file-system';
import { PaymentCollector } from 'payment-collector';
import { ApiError, OfflineError, api } from './api';
import { bindLegacyDrafts, claimDraft, getDraft, listDrafts, updateAttempt, type Draft, type DraftAttempt } from './draft-store';
import { sha256Hex } from './device';
import { assertScopeCurrent, isScopeCurrent, onScopeChange, requireRequestScope, ScopeChangedError } from './request-scope';
import { reportOperationalError } from './monitoring';

class LostAttemptError extends Error {}

async function checkpoint(attempt: DraftAttempt) {
  assertScopeCurrent(attempt.scope);
  if (!await updateAttempt(attempt)) throw new LostAttemptError();
}

/** Bounded transfer; the file itself remains private and durable on failure. */
async function uploadBytes(init: InitProofUploadResponse, bytes: Uint8Array<ArrayBuffer>, attempt: DraftAttempt) {
  await checkpoint(attempt);
  if (!init.uploadUrl) throw new Error('The proof upload could not start. Retry sync.');
  const controller = new AbortController();
  const stop = onScopeChange(() => controller.abort());
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(init.uploadUrl, {
      method: 'PUT', headers: { 'Content-Type': attempt.draft.contentType, ...init.uploadHeaders },
      body: bytes, signal: controller.signal,
    });
    assertScopeCurrent(attempt.scope);
    if (!response.ok) {
      // A prior PUT may have succeeded before its acknowledgement was lost.
      // Only Storage's documented duplicate codes allow finalize to verify the
      // existing bytes/hash; an arbitrary conflict must not bypass the upload.
      const body = response.status === 400 || response.status === 409
        ? await response.json().catch(() => null) as { code?: unknown; error?: unknown } | null : null;
      const alreadyExists = body?.code === 'ResourceAlreadyExists' || body?.error === 'Duplicate';
      if (!alreadyExists) throw new OfflineError('The proof upload was interrupted. It remains saved on this phone.');
    }
  } catch (error) {
    assertScopeCurrent(attempt.scope);
    if (error instanceof OfflineError) throw error;
    throw new OfflineError('The proof upload was interrupted. It remains saved on this phone.');
  } finally { clearTimeout(timeout); stop(); }
}

/** Stable IDs + leased SQLite ownership make retries/restarts idempotent. */
export async function syncDraft(input: Draft): Promise<{ status: SyncStatus; record?: RecordSummary }> {
  const scope = requireRequestScope();
  const attempt = await claimDraft(input, scope);
  if (!attempt) return { status: (await getDraft(input.workspaceId, input.clientRecordId))?.syncStatus ?? input.syncStatus };
  const draft = attempt.draft;
  let proofId = draft.proofId;
  try {
    await checkpoint(attempt);
    if (draft.imageUri && !proofId) {
      const bytes = await new File(draft.imageUri).bytes();
      const sha256 = await sha256Hex(bytes);
      await checkpoint(attempt);
      const init = await api<InitProofUploadResponse>('/v1/proofs/init', {
        scope, method: 'POST',
        body: { clientProofId: draft.clientRecordId, contentType: draft.contentType, byteLength: bytes.byteLength, sha256, perceptualHash: null },
      });
      if (!init.alreadyStored) {
        await uploadBytes(init, bytes, attempt);
        for (let index = 0; index < 3; index++) {
          await checkpoint(attempt);
          try {
            await api('/v1/proofs/finalize', { scope, method: 'POST', body: { proofId: init.proofId } });
            break;
          } catch (error) {
            if (index === 2 || error instanceof ScopeChangedError || (error instanceof ApiError && error.status < 500)) throw error;
            await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** index));
          }
        }
      }
      // Persist only finalized IDs. Failed finalize always re-enters init/PUT/finalize.
      if (!await updateAttempt(attempt, { proofId: init.proofId })) throw new LostAttemptError();
      proofId = init.proofId;
    }
    await checkpoint(attempt);
    if (PaymentCollector.isSupported()) {
      try { await PaymentCollector.flushNow(); } catch { /* Supplementary evidence never prevents record sync. */ }
    }
    await checkpoint(attempt);
    const result = await api<CreateRecordResponse>('/v1/records', { scope, method: 'POST', body: { ...draft.request, proofId } });
    if (!await updateAttempt(attempt, { syncStatus: 'SYNCED', serverRecordId: result.record.id, lastError: null })) throw new LostAttemptError();
    return { status: 'SYNCED', record: result.record };
  } catch (error) {
    if (error instanceof LostAttemptError) {
      return { status: isScopeCurrent(scope) ? (await getDraft(draft.workspaceId, draft.clientRecordId))?.syncStatus ?? 'LOCAL_DRAFT' : 'LOCAL_DRAFT' };
    }
    const retryable = error instanceof OfflineError || error instanceof ScopeChangedError || (error instanceof ApiError && (error.status >= 500 || error.status === 429));
    const status: SyncStatus = retryable ? (proofId ? 'PARTIAL_UPLOAD' : 'LOCAL_DRAFT') : 'FAILED';
    if (status === 'FAILED') reportOperationalError('MOBILE_SYNC_FAILED');
    const message = error instanceof ScopeChangedError ? 'Open this workspace to continue syncing.'
      : retryable ? 'Waiting to sync. Your proof is saved on this phone.'
      : error instanceof ApiError && error.status === 401 ? 'Sign in again to sync this proof.'
      : error instanceof ApiError && error.status === 403 ? 'This account no longer has access to this workspace. Your proof is saved on this phone.'
      : 'Could not sync this proof. Retry or report the problem from Settings.';
    await updateAttempt(attempt, { syncStatus: status, lastError: message });
    return { status };
  }
}

export async function syncAll(workspaceId: string): Promise<{ synced: number; pending: number; records: RecordSummary[] }> {
  const scope = requireRequestScope();
  const drafts = await listDrafts(workspaceId, true);
  const records: RecordSummary[] = [];
  let synced = 0;
  for (const draft of drafts) {
    if (!isScopeCurrent(scope)) break;
    const result = await syncDraft(draft);
    if (result.status === 'SYNCED') { synced += 1; if (result.record) records.push(result.record); }
    if (result.status === 'LOCAL_DRAFT' || result.status === 'PARTIAL_UPLOAD') break;
  }
  return { synced, pending: drafts.length - synced, records };
}

/** Explicit recovery is owner-only, with live server membership verification. */
export async function recoverLegacyDrafts(workspaceId: string): Promise<number> {
  const scope = requireRequestScope();
  if (scope.workspaceId !== workspaceId) throw new ScopeChangedError();
  const memberships = await api<WorkspaceSummary[]>('/v1/workspaces', { noWorkspace: true, scope });
  if (!memberships.some((workspace) => workspace.id === workspaceId && workspace.role === 'OWNER')) {
    throw new Error('An owner must reconnect and recover these saved scans.');
  }
  return bindLegacyDrafts(scope);
}
