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
    version: '0.1.0',
    date: '2026-09-08',
    channel: 'beta',
    highlights: [
      'Scan or import a GCash / GoTyme receipt; text is read on your phone (no cloud OCR).',
      'Records show honest evidence states: Unverified, Review needed, Notification matched, Confirmed manually.',
      'Pair a remote Android payment phone with a 5-minute single-use code — no Bluetooth or same Wi-Fi needed.',
      'Automatic matching only on exact reference + exact amount for tested GCash Express Send flows; everything else goes to Review.',
      'Owner-only incoming inbox, team invites, CSV export, and full account/workspace deletion.',
    ],
    notes: 'GoTyme notification matching is disabled until real notification samples are verified; GoTyme receipts can still be recorded and confirmed manually.',
  },
];

/** GitHub Releases: the release-android workflow attaches a signed APK to every v* tag. */
export const GITHUB_RELEASES_URL = 'https://github.com/danrave1234/pay_record/releases';

export const DOWNLOADS = {
  android: {
    playStoreUrl: process.env.NEXT_PUBLIC_PLAY_STORE_URL || null,
    /** Direct APK for beta testers (signed release build). Defaults to the latest GitHub release. */
    apkUrl: process.env.NEXT_PUBLIC_ANDROID_APK_URL || `${GITHUB_RELEASES_URL}/latest`,
    minOs: 'Android 8.0 (API 26) or newer',
  },
  ios: {
    appStoreUrl: process.env.NEXT_PUBLIC_APP_STORE_URL || null,
    testFlightUrl: process.env.NEXT_PUBLIC_TESTFLIGHT_URL || null,
    minOs: 'iOS 16 or newer',
  },
};

export const latest = (): Release => RELEASES[0]!;
