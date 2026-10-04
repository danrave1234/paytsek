import { API_VERSION_HEADER, WORKSPACE_HEADER, type ApiErrorBody, type ApiErrorCode } from '@paytsek/contracts';
import { env } from './env';
import { supabase } from './supabase';
import { assertScopeCurrent, onScopeChange, requireRequestScope, type RequestScope } from './request-scope';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export class OfflineError extends Error {
  constructor(message = 'You appear to be offline. Your work is saved locally and will sync when you reconnect.') {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the workspace header (e.g. list my workspaces, accept invite). */
  noWorkspace?: boolean;
  /** Skip the user token (device-side pairing endpoints). */
  anonymous?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Bind all stages of durable work to its original identity and workspace. */
  scope?: RequestScope;
}

/**
 * Typed API client. Every request carries the API version, the user token and
 * the explicitly selected workspace (never inferred server-side from the user).
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const scope = opts.anonymous ? null : (opts.scope ?? requireRequestScope());
  const headers: Record<string, string> = { Accept: 'application/json', [API_VERSION_HEADER]: 'v1' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.anonymous) {
    const { data } = await supabase().auth.getSession();
    assertScopeCurrent(scope!);
    if (!data.session || data.session.user.id !== scope!.userId) throw new ApiError('UNAUTHENTICATED', 'Please sign in again', 401);
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  if (!opts.noWorkspace && !opts.anonymous) {
    const ws = scope!.workspaceId;
    if (!ws) throw new ApiError('WORKSPACE_REQUIRED', 'Select a workspace first', 400);
    headers[WORKSPACE_HEADER] = ws;
  }
  const controller = new AbortController();
  const stopWatchingScope = scope ? onScopeChange(() => controller.abort()) : () => {};
  const abort = () => controller.abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  if (opts.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? 20_000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${env.apiUrl}${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: controller.signal });
    text = res.status === 204 ? '' : await res.text();
    if (scope) assertScopeCurrent(scope);
  } catch (error) {
    if (scope) assertScopeCurrent(scope);
    if (opts.signal?.aborted) throw error;
    if (timedOut) throw new OfflineError('The request timed out. It will retry automatically.');
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
    stopWatchingScope();
  }
  if (res.status === 204) return undefined as T;
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      // Gateway/proxy HTML error pages are not JSON; keep the status-based semantics.
      throw new ApiError('INTERNAL', `Request failed (${res.status})`, res.status);
    }
  }
  if (!res.ok) {
    const body = (json ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(body.code ?? 'INTERNAL', body.message ?? `Request failed (${res.status})`, res.status, body.details, body.requestId);
  }
  return json as T;
}

export const isApiError = (e: unknown, code?: ApiErrorCode): e is ApiError => e instanceof ApiError && (code === undefined || e.code === code);
