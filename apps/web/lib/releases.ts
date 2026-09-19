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
    version: '0.2.12',
    date: '2026-09-19',
    channel: 'beta',
    highlights: [
      'Auto-matching now works correctly: payment records are linked to wallet notifications automatically when the amount and time match.',
      'When the phone finds a matching notification locally, it passes the match to the server for instant linking.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.11',
    date: '2026-09-19',
    channel: 'beta',
    highlights: [
      'Payment records now sync instantly: pending wallet notifications are uploaded before the record is created, so the server can match them immediately.',
      'Auto-matching works for real wallet notifications even when the receipt has a reference number the notification does not.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.10',
    date: '2026-09-19',
    channel: 'beta',
    highlights: [
      'Auto-matching now works for real wallet notifications even when the receipt has a reference number the notification does not. A single clear amount and time match is linked automatically.',
      'Proof uploads are more reliable — brief retries handle storage delays so scans no longer fail to sync immediately.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.9',
    date: '2026-09-18',
    channel: 'beta',
    highlights: [
      'Payment records now automatically connect to a wallet notification when the amount and time match, instead of requiring a manual tap. Multiple candidates still need your choice.',
      'The receiving wallet source is now adopted onto the record when a match is found, so the record shows which wallet received the payment.',
      'Restrained animations on new records, dashboard totals, and interactive elements. Honors the system reduced-motion setting.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.8',
    date: '2026-09-16',
    channel: 'beta',
    highlights: [
      'Wallet notifications are stored on the phone as soon as they arrive, then matched to a scan by amount and time. You can see a Possible match on the review screen even before the server finishes.',
      'Permissions checklist in Settings shows whether camera, photo library, notification access, and wallet listening are ready.',
      'Day-close summary on Today, a soft duplicate-proof warning when a similar scan was just recorded, and a privacy-safe Report a problem screen with diagnostics only.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.7',
    date: '2026-09-16',
    channel: 'beta',
    highlights: [
      'Opening a payment record now re-checks for new notification matches every time, not just once. If a wallet notification arrives after you scan, the record will show the Possible match when you open it.',
      'Duplicate wallet notifications (re-posted by Android) now also trigger matching instead of being silently ignored.',
    ],
    fixes: [
      'Matching time windows are proven correct: amount-only matches use a 15-minute capture-time fallback when the receipt time is unavailable, ensuring notifications that arrive minutes before the screenshot still connect.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.5',
    date: '2026-09-15',
    channel: 'beta',
    highlights: [
      'Payer names from wallet notifications are always masked on the phone before anything is uploaded, even when a wallet shows the full name.',
      'Wallet notification recognition covers more real GCash, Maya, GoTyme, and MariBank formats, including peso-sign amounts and InstaPay reference numbers.',
    ],
    fixes: [
      'Faster, more reliable saving and syncing: offline scans upload on the next app start, shared screenshots can no longer be recorded twice, and in-app updates verify the release checksum before installing.',
      'Notification listening is more resilient: captured payments are never dropped silently, uploads retry properly, and the listener recovers from storage corruption instead of stopping.',
      'Owners can rename a workspace and change its timezone; Review paginates fully and evidence labels are consistent everywhere.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.2.0',
    date: '2026-09-14',
    channel: 'beta',
    highlights: [
      'A new five-destination navigation bar keeps Scan prominent while adding Analytics and Settings.',
      'Analytics summarizes recorded amounts by day, payment source, and evidence status.',
      'Records can be filtered by evidence and payment source, and searched by wallet or amount.',
      'GCash, Maya, GoTyme, and MariBank artwork now makes payment sources easier to recognize.',
      'Update prompts show release notes and can open Android’s installer directly inside PayTsek.',
    ],
    fixes: [
      'Improves offline draft sync, notification-collector recovery after upgrades, light and dark themes, caching, and loading behavior.',
      'Keeps receipt records even when notification evidence is unavailable and limits visible record facts to data the proof can supply.',
      'Keeps current GCash receiving notifications in Review because they show the sender number rather than the customer receipt reference.',
    ],
    notes: 'PayTsek remains a free public beta. Notification matching is supplementary evidence, not confirmation from a wallet provider.',
  },
  {
    version: '0.1.8',
    date: '2026-09-11',
    channel: 'beta',
    highlights: [
      'A scan-first mobile refresh gives payment capture the primary action while tightening navigation, loading states, spacing and visual hierarchy.',
      'PayTsek branding, app identifiers and native notification-collector packages are now consistent across the Android app, web experience and backend.',
      'The web dashboard and download experience now reflect the current PayTsek recording flow.',
    ],
    fixes: [
      'Improves dark-mode transitions with an explicit native app background to prevent a white flash during navigation.',
      'Includes the current Android package update (version code 7) so it installs over earlier PayTsek releases.',
    ],
    notes: 'Install directly over an existing PayTsek app. This beta release includes the latest local product, onboarding and platform updates.',
  },
  {
    version: '0.1.7',
    date: '2026-09-11',
    channel: 'beta',
    highlights: [
      'Google sign-in now completes securely inside PayTsek instead of remaining on the waiting screen.',
      'New email-and-password accounts open immediately without a verification-email step.',
      'A compact, rounded sign-in experience replaces the oversized scrolling form and keeps the payment-phone setup path secondary.',
    ],
    notes: 'Recommended authentication update. Install directly over your existing PayTsek app; your local app data is preserved.',
  },
  {
    version: '0.1.6',
    date: '2026-09-11',
    channel: 'beta',
    highlights: [
      'Restores production connectivity by embedding the PayTsek Supabase project and API configuration in the Android release.',
      'Google sign-in now has both the supported OAuth callback route and the production authentication configuration it requires.',
      'Release builds now stop before compilation if any required mobile production setting is missing.',
    ],
    notes: 'Required update for version 0.1.5. Install this version directly over the existing PayTsek app; no uninstall is needed.',
  },
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
      'Pair a remote Android payment phone with a 5-minute single-use code. No Bluetooth or shared Wi-Fi needed.',
      'Automatic matching requires an exact reference and exact amount on a tested flow: GCash Express Send and GCash personal QR. Everything else goes to Review.',
      'GoTyme, Maya and MariBank incoming-payment notifications are recognised on the Android payment phone and appear in Review when no matching reference is available.',
      'Owner-only incoming inbox, team invites, CSV export, and full account/workspace deletion.',
      'Unknown formats: opt in on the payment phone to collect redacted notification shapes, so a wallet that cannot auto-match yet can be supported.',
      'Earlier account-capacity experiments were removed when PayTsek moved to a free public beta.',
    ],
    notes: 'Automatic matching remains limited to flows with exact comparable evidence. GoTyme, Maya and MariBank incoming notifications are captured as supporting evidence and sent to Review when confirmation is needed.',
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
