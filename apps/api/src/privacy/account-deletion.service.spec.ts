import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import type { StorageService } from '../db/storage.service';
import type { JobsService } from '../jobs/jobs.service';
import { AccountDeletionService, accountSubjectHash } from './account-deletion.service';

const userId = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
function setup(soleOwner = false, legacyObjects = false) {
  const statements: string[] = [];
  const query = vi.fn(async (sql: string) => {
    statements.push(sql);
    if (sql.includes('not exists (select 1 from memberships other')) return { rows: soleOwner ? [{ organization_id: requestId }] : [], rowCount: soleOwner ? 1 : 0 };
    if (sql.startsWith('insert into account_deletions')) return { rows: [{ id: requestId, requested_at: new Date('2026-10-04T00:00:00Z') }], rowCount: 1 };
    if (sql.startsWith('select 1 from storage.objects')) return { rows: [], rowCount: legacyObjects ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
  const one = vi.fn(async () => ({ user_id: userId, status: 'PENDING' }));
  const db = { query, one, tx: async (fn: (tx: { query: typeof query }) => unknown) => fn({ query }) } as unknown as DbService;
  const deleteAuthUser = vi.fn(async () => undefined);
  const enqueue = vi.fn(async () => { statements.push('ENQUEUE'); });
  const service = new AccountDeletionService(db, { deleteAuthUser } as unknown as StorageService, { enqueue } as unknown as JobsService);
  return { service, statements, one, deleteAuthUser, enqueue };
}
describe('durable account deletion', () => {
  it('leaves a sole owner intact and requests ownership transfer first', async () => {
    const { service, statements, enqueue } = setup(true);
    await expect(service.request(userId)).rejects.toThrow('Transfer ownership');
    expect(enqueue).not.toHaveBeenCalled();
    expect(statements.some((sql) => sql.startsWith('delete'))).toBe(false);
  });
  it('commits a retriable request before revoking memberships; business rows are preserved', async () => {
    const { service, statements } = setup();
    await expect(service.request(userId)).resolves.toMatchObject({ requestId, status: 'PENDING' });
    expect(statements.indexOf('ENQUEUE')).toBeLessThan(statements.findIndex((sql) => sql.startsWith('delete from memberships')));
    expect(statements.some((sql) => /delete from (payment_records|payment_proofs|audit_events)/.test(sql))).toBe(false);
    expect(accountSubjectHash(userId)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('retains pending identity and records a safe retry code when Auth is unavailable', async () => {
    const { service, statements, deleteAuthUser } = setup();
    deleteAuthUser.mockRejectedValue(new Error('private provider response'));
    await expect(service.process(requestId)).rejects.toThrow('ACCOUNT_DELETE_RETRY');
    expect(statements.some((sql) => sql.includes("status='COMPLETE'"))).toBe(false);
    expect(statements.some((sql) => sql.includes('last_error_code=$2'))).toBe(true);
  });
  it('clears the retained identity only after Auth acknowledges deletion', async () => {
    const { service, statements, deleteAuthUser } = setup();
    await service.process(requestId);
    expect(deleteAuthUser).toHaveBeenCalledWith(userId);
    expect(statements.at(-1)).toContain("status='COMPLETE'");
    expect(statements.at(-1)).toContain('user_id=null');
  });
  it('replaying a completed request makes no Auth call', async () => {
    const { service, one, deleteAuthUser } = setup();
    one.mockResolvedValue({ user_id: userId, status: 'COMPLETE' });
    await service.process(requestId);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });
  it('preserves legacy personally-owned files for reviewed API migration', async () => {
    const { service, statements, deleteAuthUser } = setup(false,true);
    await expect(service.process(requestId)).rejects.toThrow('ACCOUNT_STORAGE_REVIEW_REQUIRED');
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(statements.some((sql) => /(?:delete from|update) storage\./.test(sql))).toBe(false);
  });
});
