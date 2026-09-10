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
    version: '0.1.5',
    date: '2026-09-11',
    channel: 'beta',
    highlights: [
      'Google sign-in now returns directly to PayTsek through the supported OAuth callback instead of opening an unmatched route.',
      'Android recognises this installer as an upgrade from version 0.1.4, so existing users can update without uninstalling.',
      'The release workflow now builds, signs and publishes the phone-only APK on Linux with current GitHub Actions tooling.',
    ],
    notes: 'Recommended update for everyone using Google sign-in. The installer remains signed with the same PayTsek Android key as version 0.1.4.',
  },
  {
    version: '0.1.4',
    date: '2026-09-10',
    channel: 'beta',
    highlights: [
      'A smaller 83 MB Android installer that removes emulator-only libraries and shrinks unused Android code while retaining support for 32-bit and 64-bit phones.',
      'Scan or import the customer’s GCash, GoTyme, Maya or MariBank payment confirmation; the text is read on your phone (no cloud OCR).',
      'Records carry honest evidence states: Unverified, Review needed, Notification matched, Confirmed manually.',
      'Pair a remote Android payment phone with a 5-minute single-use code — no Bluetooth or shared Wi-Fi needed.',
      'Automatic matching requires an exact reference and exact amount on a tested flow: GCash Express Send and GCash personal QR. Everything else goes to Review.',
      'GoTyme, Maya and MariBank incoming-payment notifications are recognised on the Android payment phone and appear in Review when no matching reference is available.',
      'Owner-only incoming inbox, team invites, CSV export, and full account/workspace deletion.',
      'Unknown formats: opt in on the payment phone to collect redacted notification shapes, so a wallet that cannot auto-match yet can be supported.',
      'Clearer billing: Free, Starter and Business plans, exact access end dates, and early renewal that preserves unused paid time.',
    ],
    notes: 'Automatic matching remains limited to flows with an exact comparable reference. GoTyme, Maya and MariBank incoming notifications are captured as payment evidence and sent to Review when confirmation is needed. QRPh renewals are manually approved each 30-day period; automatic billing is not available for QRPh.',
  },
];

/** GitHub Releases: the release-android workflow attaches a signed APK to every v* tag. */
export const GITHUB_RELEASES_URL = 'https://github.com/danrave1234/paytsek/releases';

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
