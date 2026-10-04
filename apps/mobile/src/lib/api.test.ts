import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, OfflineError } from './api';
import { setRequestScope, ScopeChangedError } from './request-scope';

const auth = vi.hoisted(() => ({ userId: 'account-a', calls: vi.fn() }));
vi.mock('./env', () => ({ env: { apiUrl: 'https://synthetic.invalid' } }));
vi.mock('./supabase', () => ({ supabase: () => ({ auth: { getSession: auth.calls } }) }));
beforeEach(() => {
  vi.restoreAllMocks();
  setRequestScope('account-a', 'workspace-a');
  auth.userId = 'account-a';
  auth.calls.mockReset().mockImplementation(async () => ({ data: { session: { user: { id: auth.userId }, access_token: 'synthetic-only' } } }));
});

describe('immutable API scope', () => {
  it('cannot substitute a newly selected workspace while waiting for credentials', async () => {
    let release!: (value: unknown) => void;
    auth.calls.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const fetch = vi.spyOn(globalThis, 'fetch');
    const pending = api('/v1/proofs/init');
    setRequestScope('account-a', 'workspace-b');
    release({ data: { session: { user: { id: 'account-a' }, access_token: 'synthetic-only' } } });
    await expect(pending).rejects.toBeInstanceOf(ScopeChangedError);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('aborts an old request and discards its late response on account switch', async () => {
    let release!: (response: Response) => void;
    let signal: AbortSignal | null = null;
    let started!: () => void;
    const didStart = new Promise<void>((resolve) => { started = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      signal = options!.signal!;
      started();
      return new Promise((resolve) => { release = resolve; });
    });
    const pending = api('/v1/records');
    await didStart;
    setRequestScope('account-b', 'workspace-b');
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    release(new Response('{"old":"data"}', { status: 200 }));
    await expect(pending).rejects.toBeInstanceOf(ScopeChangedError);
  });
  it('rejects credentials belonging to another account before sending any request', async () => {
    auth.userId = 'account-b';
    const fetch = vi.spyOn(globalThis, 'fetch');
    await expect(api('/v1/records')).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not report user cancellation as offline', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const controller = new AbortController();
    const pending = api('/v1/records', { signal: controller.signal });
    await Promise.resolve();
    controller.abort();
    await expect(pending).rejects.not.toBeInstanceOf(OfflineError);
  });
});
