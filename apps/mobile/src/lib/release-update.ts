import { useQuery } from '@tanstack/react-query';
import { APP_VERSION } from './env';

const RELEASES_URL = 'https://api.github.com/repos/danrave1234/paytsek/releases/latest';

type GitHubRelease = {
  tag_name: string;
  html_url: string;
  published_at: string | null;
  assets: Array<{ name: string; browser_download_url: string }>;
};

export type AppUpdate = { version: string; downloadUrl: string; publishedAt: string | null };

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

async function latestRelease(): Promise<AppUpdate | null> {
  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) return null; // Offline, rate-limited, or not yet released: never block the app.
  const release = await response.json() as GitHubRelease;
  const apk = release.assets.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
  if (!apk || !isNewerVersion(release.tag_name, APP_VERSION)) return null;
  return { version: release.tag_name.replace(/^v/i, ''), downloadUrl: apk.browser_download_url, publishedAt: release.published_at };
}

/** Checks infrequently and only displays an update when a signed APK is actually published. */
export function useAppUpdate() {
  return useQuery({
    queryKey: ['app-update', APP_VERSION],
    queryFn: latestRelease,
    staleTime: 6 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
  });
}
