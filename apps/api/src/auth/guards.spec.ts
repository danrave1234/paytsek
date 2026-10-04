import type { ExecutionContext } from '@nestjs/common';
import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import type { DbService } from '../db/db.service';
import { accountSubjectHash } from '../privacy/account-deletion.service';
import { UserAuthGuard } from './guards';

vi.mock('../config/env', () => ({ loadEnv: () => ({
  SUPABASE_URL: 'https://auth.example.invalid',
  SUPABASE_JWT_SECRET: 'synthetic-unit-test-signing-key-not-a-real-secret',
}) }));

const userId = '00000000-0000-4000-8000-000000000001';
async function context() {
  const token = await new SignJWT({ sub: userId, aud: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('2m')
    .sign(new TextEncoder().encode('synthetic-unit-test-signing-key-not-a-real-secret'));
  return { switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }) } as unknown as ExecutionContext;
}

describe('account deletion session block', () => {
  it('rejects a valid previously issued token after the deletion commit', async () => {
    const one = vi.fn(async () => ({ exists: true }));
    const guard = new UserAuthGuard({ one } as unknown as DbService);
    await expect(guard.canActivate(await context())).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(one).toHaveBeenCalledWith(expect.stringContaining('subject_hash=$1'), [accountSubjectHash(userId)]);
  });
  it('permits a valid non-deleting account', async () => {
    const guard = new UserAuthGuard({ one: async () => null } as unknown as DbService);
    await expect(guard.canActivate(await context())).resolves.toBe(true);
  });
  it('does not misreport a database outage as an expired mobile session', async () => {
    const outage = new Error('DATABASE_UNAVAILABLE');
    const guard = new UserAuthGuard({ one: async () => { throw outage; } } as unknown as DbService);
    await expect(guard.canActivate(await context())).rejects.toBe(outage);
  });
});
