import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadEnv } from '../config/env';

/**
 * Private Supabase Storage access. Uses the service role on the server only;
 * clients only ever receive short-lived signed URLs.
 */
@Injectable()
export class StorageService {
  private readonly client: SupabaseClient;
  private readonly env = loadEnv();

  constructor() {
    this.client = createClient(this.env.SUPABASE_URL, this.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, init) => fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(5_000) }) },
    });
  }

  proofPath(organizationId: string, proofId: string, contentType: string): string {
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/heic' ? 'heic' : 'jpg';
    return `${organizationId}/${proofId}.${ext}`;
  }

  async createSignedUpload(bucket: string, path: string): Promise<{ url: string; token: string }> {
    const { data, error } = await this.client.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error(`storage signed upload failed: ${error?.message ?? 'unknown'}`);
    return { url: data.signedUrl, token: data.token };
  }

  async createSignedDownload(bucket: string, path: string, ttlSeconds?: number): Promise<{ url: string; expiresAt: Date }> {
    const ttl = ttlSeconds ?? this.env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS;
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(path, ttl);
    if (error || !data) throw new Error(`storage signed download failed: ${error?.message ?? 'unknown'}`);
    return { url: data.signedUrl, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /** Returns object metadata or null when the object does not exist. */
  async stat(bucket: string, path: string): Promise<{ size: number; contentType: string | null } | null> {
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const name = path.slice(path.lastIndexOf('/') + 1);
    const { data, error } = await this.client.storage.from(bucket).list(dir, { search: name, limit: 1 });
    if (error) throw new Error(`storage stat failed: ${error.message}`);
    const obj = data?.find((o) => o.name === name);
    if (!obj) return null;
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
    return { size: meta.size ?? 0, contentType: meta.mimetype ?? null };
  }

  async upload(bucket: string, path: string, body: Buffer | string, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).upload(path, body, { contentType, upsert: true });
    if (error) throw new Error(`storage upload failed: ${error.message}`);
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
  }

  async downloadBounded(bucket: string, path: string, maxBytes: number): Promise<Buffer> {
    const { url } = await this.createSignedDownload(bucket, path, 30);
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok || !response.body) throw new Error('PROOF_DOWNLOAD_FAILED');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new Error('PROOF_SIZE_LIMIT');
        chunks.push(value);
      }
      return Buffer.concat(chunks, length);
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }

  async privateBucketsReady(): Promise<boolean> {
    const buckets = await Promise.all([this.proofsBucket, this.exportsBucket].map((name) => this.client.storage.getBucket(name)));
    return buckets.every(({ data, error }) => !error && data?.public === false);
  }

  async deleteAuthUser(userId: string): Promise<void> {
    const { error } = await this.client.auth.admin.deleteUser(userId);
    // Retrying after successful Auth deletion must remain idempotent.
    if (error && error.status !== 404 && error.code !== 'user_not_found') throw new Error('AUTH_DELETE_FAILED');
  }

  get proofsBucket(): string {
    return this.env.STORAGE_BUCKET_PROOFS;
  }
  get exportsBucket(): string {
    return this.env.STORAGE_BUCKET_EXPORTS;
  }
}
