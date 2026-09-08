/**
 * Release feed shown on /updates and /download. Edit this file per release
 * (or replace with a CMS later). Download URLs are DEPLOYMENT INPUTS: leave
 * null until the store listing / signed build exists — the page then shows an
 * honest "not yet available" state instead of a dead link.
 */
export interface Release {
  version: string;
  date: string; // ISO date
  channel: 'stable' | 'beta';
  highlights: string[];
  fixes?: string[];
  notes?: string;
}

export const RELEASES: Release[] = [
  {
    version: '0.1.1',
    date: '2026-09-09',
    channel: 'beta',
    highlights: [
      'Scan or import the customer’s GCash, GoTyme, Maya or MariBank payment confirmation; the text is read on your phone (no cloud OCR).',
      'Records carry honest evidence states: Unverified, Review needed, Notification matched, Confirmed manually.',
      'Pair a remote Android payment phone with a 5-minute single-use code — no Bluetooth or shared Wi-Fi needed.',
      'Automatic matching requires an exact reference and exact amount on a tested flow: GCash Express Send and GCash personal QR. Everything else goes to Review.',
      'Owner-only incoming inbox, team invites, CSV export, and full account/workspace deletion.',
      'Unknown formats: opt in on the payment phone to collect redacted notification shapes, so a wallet that cannot auto-match yet can be supported.',
    ],
    notes: 'Notification matching is enabled for tested GCash flows only. GoTyme, Maya and MariBank notifications are not parsed yet — no verified samples exist — so payments to those wallets are recorded and confirmed manually.',
  },
];

/** GitHub Releases: the release-android workflow attaches a signed APK to every v* tag. */
export const GITHUB_RELEASES_URL = 'https://github.com/danrave1234/pay_record/releases';

export const DOWNLOADS = {
  android: {
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
    /**
     * Served from our own domain so nobody lands on a GitHub release page
     * hunting for an asset; /download/android redirects to the stable-named
     * APK that the release workflow publishes.
     */
    apkUrl: process.env.NEXT_PUBLIC_ANDROID_APK_URL || '/download/android',
    minOs: 'Android 8.0 (API 26) or newer',
  },
  ios: {
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
    testFlightUrl: process.env.NEXT_PUBLIC_TESTFLIGHT_URL || null,
    minOs: 'iOS 16 or newer',
  },
};

export const latest = (): Release => RELEASES[0]!;
