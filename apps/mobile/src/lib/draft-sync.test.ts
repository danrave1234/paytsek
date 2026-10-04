import { randomUUID, createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { draftFixture, recordFixture, TEST_USER, TEST_WORKSPACE } from './test-fixtures';
import { getRequestScope, setRequestScope } from './request-scope';
import { ApiError } from './api';

const calls = vi.hoisted(() => ({ api: vi.fn(), update: vi.fn(), bind: vi.fn() }));
vi.mock('./api', () => ({
  api: calls.api,
  ApiError: class extends Error { constructor(public code: string, message: string, public status: number) { super(message); } },
  OfflineError: class extends Error {},
}));
vi.mock('./device', () => ({ newId: randomUUID, sha256Hex: async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex') }));
vi.mock('payment-collector', () => ({ PaymentCollector: { isSupported: () => false } }));
vi.mock('./monitoring', () => ({ reportOperationalError: vi.fn() }));
vi.mock('expo-file-system', () => ({ File: class { bytes = async () => new Uint8Array([1, 2, 3]); } }));
vi.mock('./draft-store', () => ({
  claimDraft: async (draft: unknown, scope: unknown) => ({ draft, scope, id: 'attempt' }),
  updateAttempt: calls.update,
  bindLegacyDrafts: calls.bind,
  getDraft: async () => null, listDrafts: async () => [],
}));
import { recoverLegacyDrafts, syncDraft } from './draft-sync';
beforeEach(() => {
  setRequestScope(TEST_USER, TEST_WORKSPACE);
  calls.api.mockReset(); calls.bind.mockReset(); calls.update.mockReset();
  calls.update.mockResolvedValue(true);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
});

describe('proof upload ordering and recovery', () => {
  it('reuses stable record/proof ids with an immutable workspace on every stage', async () => {
    const draft = draftFixture();
    calls.api.mockImplementation(async (path) => path.endsWith('/init')
      ? { proofId: 'proof', alreadyStored: false, uploadUrl: 'https://synthetic.invalid/upload', uploadHeaders: {} }
      : path === '/v1/records' ? { record: recordFixture() } : {});
    expect((await syncDraft(draft)).status).toBe('SYNCED');
    expect(calls.api.mock.calls.map(([path]) => path)).toEqual(['/v1/proofs/init', '/v1/proofs/finalize', '/v1/records']);
    for (const [, options] of calls.api.mock.calls) expect(options.scope).toEqual(getRequestScope());
    expect(calls.api.mock.calls[0]![1].body.clientProofId).toBe(draft.clientRecordId);
    expect(calls.api.mock.calls[2]![1].body.clientRecordId).toBe(draft.clientRecordId);
  });
  it('does not persist an unfinalized proof ID or create a record when validation fails', async () => {
    calls.api.mockImplementation(async (path) => {
      if (path.endsWith('/init')) return { proofId: 'proof', alreadyStored: false, uploadUrl: 'https://synthetic.invalid/upload', uploadHeaders: {} };
      throw new ApiError('VALIDATION_FAILED', 'Synthetic invalid image', 400);
    });
    expect((await syncDraft(draftFixture())).status).toBe('FAILED');
    expect(calls.api.mock.calls.some(([path]) => path === '/v1/records')).toBe(false);
    expect(calls.update.mock.calls.some(([, patch]) => patch?.proofId === 'proof')).toBe(false);
  });
  it('retries record creation without reuploading an acknowledged finalized proof', async () => {
    calls.api.mockResolvedValue({ record: recordFixture() });
    expect((await syncDraft(draftFixture({ proofId: 'finalized-proof', syncStatus: 'PARTIAL_UPLOAD' }))).status).toBe('SYNCED');
    expect(calls.api.mock.calls.map(([path]) => path)).toEqual(['/v1/records']);
    expect(calls.api.mock.calls[0]![1].body.proofId).toBe('finalized-proof');
  });
  it.each([
    { status: 400, body: { error: 'Duplicate' } },
    { status: 409, body: { code: 'ResourceAlreadyExists' } },
  ])('finalizes existing bytes after an interrupted prior upload ($status)', async ({ status, body }) => {
    calls.api.mockImplementation(async (path) => path.endsWith('/init')
      ? { proofId: 'proof', alreadyStored: false, uploadUrl: 'https://synthetic.invalid/upload', uploadHeaders: { 'x-upsert': 'false' } }
      : path === '/v1/records' ? { record: recordFixture() } : {});
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status }));
    expect((await syncDraft(draftFixture())).status).toBe('SYNCED');
    expect(calls.api.mock.calls.map(([path]) => path)).toEqual(['/v1/proofs/init', '/v1/proofs/finalize', '/v1/records']);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.headers).toMatchObject({ 'x-upsert': 'false' });
  });
  it('does not treat an unrelated storage conflict as a completed upload', async () => {
    calls.api.mockResolvedValue({ proofId: 'proof', alreadyStored: false, uploadUrl: 'https://synthetic.invalid/upload', uploadHeaders: {} });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: 'Conflict' }), { status: 409 }));
    expect((await syncDraft(draftFixture())).status).toBe('LOCAL_DRAFT');
    expect(calls.api.mock.calls.map(([path]) => path)).toEqual(['/v1/proofs/init']);
    expect(calls.update.mock.calls.some(([, patch]) => patch?.proofId === 'proof')).toBe(false);
  });
  it('does not bind legacy scans based on cached owner status', async () => {
    calls.api.mockResolvedValue([{ id: TEST_WORKSPACE, role: 'CASHIER' }]);
    await expect(recoverLegacyDrafts(TEST_WORKSPACE)).rejects.toThrow('owner');
    expect(calls.bind).not.toHaveBeenCalled();
    calls.api.mockResolvedValue([{ id: TEST_WORKSPACE, role: 'OWNER' }]);
    calls.bind.mockResolvedValue(2);
    expect(await recoverLegacyDrafts(TEST_WORKSPACE)).toBe(2);
  });
});
