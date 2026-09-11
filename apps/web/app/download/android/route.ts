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
const APK_URL = `${GITHUB_RELEASES_URL}/download/v${release.version}/PayTsek-v${release.version}.apk`;

export function GET(): Response {
  return Response.redirect(APK_URL, 302);
}
