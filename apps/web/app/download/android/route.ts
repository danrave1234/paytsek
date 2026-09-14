import { GITHUB_RELEASES_URL, latest } from '@/lib/releases';

/**
 * One-click APK download from paytsek.online.
 *
 * The binary lives on GitHub Releases — free, versioned, unlimited bandwidth,
 * and already produced by CI — but sellers should never have to visit a
 * release page and pick a file out of a list of source archives. This route
 * sends them straight to the installer instead.
 *
 * The target is the explicitly versioned release asset. It makes the version
 * visible in the downloaded filename, avoiding ambiguity with an older
 * installer a customer may already have in their Downloads folder.
 *
 * Redirecting rather than proxying keeps a ~70 MB download off Vercel's
 * bandwidth budget and off the serverless response path.
 */
const release = latest();
const FALLBACK_APK_URL = `${GITHUB_RELEASES_URL}/download/v${release.version}/PayTsek-v${release.version}.apk`;

/** Same repo the mobile in-app updater polls (apps/mobile/src/lib/release-update.ts). */
const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/danrave1234/paytsek/releases/latest';

export async function GET(): Promise<Response> {
  try {
    // Resolve the truly latest APK so the redirect never serves a stale build;
    // revalidation keeps us far under GitHub's unauthenticated rate limit.
    const response = await fetch(GITHUB_LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 300 },
    });
    if (response.ok) {
      const data = await response.json() as { assets?: Array<{ name: string; browser_download_url: string }> };
      const apk = data.assets?.find((asset) => asset.name.toLowerCase().endsWith('.apk'));
      if (apk) return Response.redirect(apk.browser_download_url, 302);
    }
  } catch {
    // GitHub unreachable: fall through to the last known release.
  }
  return Response.redirect(FALLBACK_APK_URL, 302);
}
