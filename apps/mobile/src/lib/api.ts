import { API_VERSION_HEADER, WORKSPACE_HEADER, type ApiErrorBody, type ApiErrorCode } from '@payrecord/contracts';
import { env } from './env';
import { getAccessToken } from './supabase';
import { getActiveWorkspaceId } from './workspace';

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
  constructor() {
    super('You appear to be offline. Your work is saved locally and will sync when you reconnect.');
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the workspace header (e.g. list my workspaces, accept invite). */
  noWorkspace?: boolean;
  /** Skip the user token (device-side pairing endpoints). */
  anonymous?: boolean;
  timeoutMs?: number;
}

/**
 * Typed API client. Every request carries the API version, the user token and
 * the explicitly selected workspace (never inferred server-side from the user).
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', [API_VERSION_HEADER]: 'v1' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!opts.anonymous) {
    const token = await getAccessToken();
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Please sign in again', 401);
    headers.Authorization = `Bearer ${token}`;
  }
  if (!opts.noWorkspace && !opts.anonymous) {
    const ws = await getActiveWorkspaceId();
    if (!ws) throw new ApiError('WORKSPACE_REQUIRED', 'Select a workspace first', 400);
    headers[WORKSPACE_HEADER] = ws;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: controller.signal });
  } catch {
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const body = (json ?? {}) as Partial<ApiErrorBody>;
    throw new ApiError(body.code ?? 'INTERNAL', body.message ?? `Request failed (${res.status})`, res.status, body.details, body.requestId);
  }
  return json as T;
}

export const isApiError = (e: unknown, code?: ApiErrorCode): e is ApiError => e instanceof ApiError && (code === undefined || e.code === code);
