import { useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';
import { APP_VERSION } from './env';

const RELEASES_URL = 'https://api.github.com/repos/danrave1234/paytsek/releases/latest';

type GitHubRelease = {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
};

export type AppUpdate = {
  version: string;
  title: string;
  notes: string[];
  downloadUrl: string;
  releaseUrl: string;
  publishedAt: string | null;
  sizeBytes: number;
};

const APK_MIME_TYPE = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

function versionParts(value: string): number[] {
  const match = value.match(/v?(\d+(?:\.\d+){0,2})/i)?.[1] ?? '0';
  return match.split('.').map(Number).concat([0, 0, 0]).slice(0, 3);
}

export function isNewerVersion(candidate: string, current: string) {
  const next = versionParts(candidate);
  const installed = versionParts(current);
  for (let index = 0; index < next.length; index += 1) {
    if (next[index] !== installed[index]) return next[index]! > installed[index]!;
  }
  return false;
}

export function parseReleaseNotes(body: string | null): string[] {
  if (!body) return ['Reliability and usability improvements.'];
  const notes = body
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\s*(?:[-*+]\s+|#{1,6}\s*)/, '')
      .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim())
    .filter((line) => line && !/^what'?s changed:?$/i.test(line) && !/^full changelog:?/i.test(line))
    .slice(0, 8)
    .map((line) => line.slice(0, 180));
  return notes.length ? notes : ['Reliability and usability improvements.'];
}

async function latestRelease(): Promise<AppUpdate | null> {
  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return null; // Offline, rate-limited, or not yet released: never block the app.
  const release = await response.json() as GitHubRelease;
  const apk = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
  if (!apk || !isNewerVersion(release.tag_name, APP_VERSION)) return null;
  const version = release.tag_name.replace(/^v/i, '');
  return {
    version,
    title: release.name?.trim() || `PayTsek ${version}`,
    notes: parseReleaseNotes(release.body),
    downloadUrl: apk.browser_download_url,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
    sizeBytes: apk.size,
  };
}

/** Checks infrequently and only displays an update when a signed APK is actually published. */
export function useAppUpdate() {
  return useQuery({
    queryKey: ['app-update', APP_VERSION],
    queryFn: latestRelease,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
}

/**
 * Downloads a release APK into PayTsek's private cache and opens Android's
 * package installer. Opening the GitHub link in a browser leaves the final
 * install step to browser-specific download handling, which is unreliable on
 * in-app browsers.
 */
export async function downloadAndInstallUpdate(
  update: AppUpdate,
  onProgress: (progress: number) => void,
): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(update.downloadUrl);
    return;
  }

  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('Update storage is unavailable.');

  const safeVersion = update.version.replace(/[^0-9A-Za-z.-]/g, '-');
  const destination = `${cacheDirectory}PayTsek-${safeVersion}.apk`;
  // Android may send the person to Settings to allow installs from PayTsek.
  // The app becomes active again afterwards, so reuse the completed, versioned
  // APK rather than deleting it and downloading it a second time.
  const existing = await FileSystem.getInfoAsync(destination);
  let apkUri = existing.exists && (existing.size ?? 0) > 0 ? destination : null;

  if (!apkUri) {
    const task = FileSystem.createDownloadResumable(update.downloadUrl, destination, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      onProgress(totalBytesExpectedToWrite > 0 ? totalBytesWritten / totalBytesExpectedToWrite : 0);
    });
    const result = await task.downloadAsync();
    if (!result?.uri) throw new Error('The update download did not finish.');
    apkUri = result.uri;
  }

  const contentUri = await FileSystem.getContentUriAsync(apkUri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME_TYPE,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
