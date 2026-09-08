import { GITHUB_RELEASES_URL } from '@/lib/releases';

/**
 * One-click APK download from payrecord.ph.
 *
 * The binary lives on GitHub Releases — free, versioned, unlimited bandwidth,
 * and already produced by CI — but sellers should never have to visit a
 * release page and pick a file out of a list of source archives. This route
 * sends them straight to the installer instead.
 *
 * The target is GitHub's permanent "latest release asset" URL, so no API call
 * is involved: no token, no 60-requests-per-hour rate limit, and nothing to
 * change when a new version ships. The release workflow publishes a
 * stable-named `PayRecord-latest.apk` next to the versioned asset precisely so
 * this URL stays valid.
 *
 * Redirecting rather than proxying keeps a ~70 MB download off Vercel's
 * bandwidth budget and off the serverless response path.
 */
const LATEST_APK = `${GITHUB_RELEASES_URL}/latest/download/PayRecord-latest.apk`;

export function GET(): Response {
  return Response.redirect(LATEST_APK, 302);
}
