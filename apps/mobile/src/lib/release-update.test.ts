import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ files: new Map<string, Uint8Array>(), bytes: new Uint8Array([80, 75, 3, 4]), install: vi.fn(), downloads: vi.fn(), query: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: state.query }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: vi.fn() } }));
vi.mock('./env', () => ({ APP_VERSION: '0.2.14' }));
vi.mock('expo-intent-launcher', () => ({ startActivityAsync: state.install }));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA256' }, digest: async (_algorithm: string, bytes: Uint8Array) => new Uint8Array(createHash('sha256').update(bytes).digest()).buffer }));
vi.mock('expo-file-system', () => ({ File: class { constructor(private uri: string) {} bytes = async () => state.files.get(this.uri)!; } }));
vi.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///synthetic-cache/', EncodingType: { Base64: 'base64' },
  getInfoAsync: async (uri: string) => ({ exists: state.files.has(uri), size: state.files.get(uri)?.byteLength ?? 0 }),
  deleteAsync: async (uri: string) => { state.files.delete(uri); },
  createDownloadResumable: (_url: string, uri: string) => ({ downloadAsync: async () => {
    state.downloads(); state.files.set(uri, state.bytes); return { uri, status: 200 };
  } }),
  readAsStringAsync: async (uri: string) => Buffer.from(state.files.get(uri)!).subarray(0, 4).toString('base64'),
  moveAsync: async ({ from, to }: { from: string; to: string }) => { state.files.set(to, state.files.get(from)!); state.files.delete(from); },
  getContentUriAsync: async (uri: string) => `content://synthetic/${uri.split('/').pop()}`,
}));
import { downloadAndInstallUpdate, useAppUpdate, type AppUpdate } from './release-update';

const update: AppUpdate = { version: '0.2.15', title: 'Synthetic release', notes: [], downloadUrl: 'https://example.invalid/app.apk',
  releaseUrl: 'https://example.invalid/release', checksumUrl: 'https://example.invalid/app.apk.sha256', sizeBytes: 4, publishedAt: null };
const digest = () => createHash('sha256').update(state.bytes).digest('hex');
beforeEach(() => {
  state.files.clear(); state.downloads.mockClear(); state.install.mockClear(); state.query.mockReset();
  state.bytes = new Uint8Array([80, 75, 3, 4]);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(`${digest()}  PayTsek.apk`));
});

describe('release integrity', () => {
  it('does not offer a published APK that has no checksum asset', async () => {
    state.query.mockImplementation((options) => options);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ tag_name: 'v0.2.15', assets: [{ name: 'PayTsek.apk', browser_download_url: update.downloadUrl, size: 4 }] })));
    const query = useAppUpdate() as unknown as { queryFn: () => Promise<unknown> };
    expect(await query.queryFn()).toBeNull();
  });
  it('never opens Android installer without a valid expected digest', async () => {
    await expect(downloadAndInstallUpdate({ ...update, checksumUrl: null }, vi.fn())).rejects.toThrow('checksum');
    vi.mocked(fetch).mockResolvedValue(new Response('not-a-checksum'));
    await expect(downloadAndInstallUpdate(update, vi.fn())).rejects.toThrow('checksum');
    expect(state.install).not.toHaveBeenCalled();
    expect(state.downloads).not.toHaveBeenCalled();
  });
  it('deletes a corrupt download and never invokes the installer', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(`${'0'.repeat(64)}  PayTsek.apk`));
    await expect(downloadAndInstallUpdate(update, vi.fn())).rejects.toThrow('failed checksum');
    expect(state.files.size).toBe(0);
    expect(state.install).not.toHaveBeenCalled();
  });
  it('verifies a cached APK again and replaces corrupt cached bytes', async () => {
    state.files.set('file:///synthetic-cache/PayTsek-0.2.15.apk', new Uint8Array([1, 2, 3, 4]));
    await downloadAndInstallUpdate(update, vi.fn());
    expect(state.downloads).toHaveBeenCalledTimes(1);
    expect(state.install).toHaveBeenCalledTimes(1);
    expect(state.files.get('file:///synthetic-cache/PayTsek-0.2.15.apk')).toEqual(state.bytes);
  });
});
