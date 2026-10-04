import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIGN_OUT_RETRY_MESSAGE, signOutConfirmed } from './sign-out';

afterEach(() => { vi.useRealTimers(); });

async function syntheticClient() {
  const values = new Map<string, string>();
  const storageKey = 'synthetic-sdk-session';
  const client = createClient('https://synthetic.invalid', 'synthetic-anon', {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, storageKey, storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    } },
    global: { fetch: async () => new Response('{}', { status: 503 }) },
  });
  await client.auth.initialize();
  const seed = (expiresAt: number) => values.set(storageKey, JSON.stringify({
    access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_at: expiresAt,
    token_type: 'bearer', user: { id: '00000000-0000-4000-8000-000000000001' },
  }));
  return { client, seed, stored: () => values.has(storageKey) };
}

describe('SDK-confirmed sign out', () => {
  it('preserves the visible account and cache when expired-session refresh fails offline', async () => {
    const state = { signedIn: true, workspace: 'synthetic-workspace' };
    const clear = vi.fn();
    const sdk = vi.fn().mockResolvedValue({ error: new Error('Synthetic refresh failure') });
    await expect(signOutConfirmed(sdk, () => !state.signedIn, clear)).rejects.toThrow(SIGN_OUT_RETRY_MESSAGE);
    expect(state).toEqual({ signedIn: true, workspace: 'synthetic-workspace' });
    expect(clear).not.toHaveBeenCalled();
  });
  it('accepts a remote error after SIGNED_OUT confirms local removal', async () => {
    let confirmed = false;
    const clear = vi.fn().mockResolvedValue(undefined);
    await signOutConfirmed(async () => { confirmed = true; return { error: new Error('Synthetic logout network failure') }; }, () => confirmed, clear);
    expect(clear).toHaveBeenCalledOnce();
  });
  it('does not claim sign out from an HTTP success without the SDK event', async () => {
    const clear = vi.fn();
    await expect(signOutConfirmed(async () => ({ error: null }), () => false, clear)).rejects.toThrow(SIGN_OUT_RETRY_MESSAGE);
    expect(clear).not.toHaveBeenCalled();
  });
  it('reports a thrown storage failure without clearing account data', async () => {
    const clear = vi.fn();
    await expect(signOutConfirmed(async () => { throw new Error('Synthetic storage failure'); }, () => false, clear)).rejects.toThrow(SIGN_OUT_RETRY_MESSAGE);
    expect(clear).not.toHaveBeenCalled();
  });
  it('clears account cache only after the success event', async () => {
    let confirmed = false;
    const clear = vi.fn(async () => { expect(confirmed).toBe(true); });
    await signOutConfirmed(async () => { confirmed = true; return { error: null }; }, () => confirmed, clear);
    expect(clear).toHaveBeenCalledOnce();
  });
  it('matches the installed SDK: logout HTTP failure removes an unexpired local session', async () => {
    const { client, seed, stored } = await syntheticClient();
    let confirmed = false;
    const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') confirmed = true; });
    await client.auth.getSession();
    seed(Math.floor(Date.now() / 1000) + 3600);
    const clear = vi.fn().mockResolvedValue(undefined);
    await signOutConfirmed(() => client.auth.signOut({ scope: 'local' }), () => confirmed, clear);
    expect(stored()).toBe(false);
    expect(clear).toHaveBeenCalledOnce();
    data.subscription.unsubscribe();
  });
  it('matches the installed SDK: expired-session offline refresh preserves the session', async () => {
    const { client, seed, stored } = await syntheticClient();
    let confirmed = false;
    const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') confirmed = true; });
    await client.auth.getSession();
    seed(Math.floor(Date.now() / 1000) - 60);
    vi.useFakeTimers();
    const clear = vi.fn();
    const expected = expect(signOutConfirmed(() => client.auth.signOut({ scope: 'local' }), () => confirmed, clear)).rejects.toThrow(SIGN_OUT_RETRY_MESSAGE);
    await vi.runAllTimersAsync();
    await expected;
    expect(stored()).toBe(true);
    expect(confirmed).toBe(false);
    expect(clear).not.toHaveBeenCalled();
    data.subscription.unsubscribe();
  });
});
