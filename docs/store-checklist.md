# Store submission checklist

## Both stores

- [ ] Privacy policy URL (`/privacy`), terms URL (`/terms`), support URL with in-app **and** web account-deletion instructions (`/support`).
- [ ] Reviewer test account: owner + cashier in a **demo workspace** (`organizations.is_demo = true`). Demo records never mix with production totals or billing. Provide a scripted walkthrough: sign in → scan the provided sample receipt image → see Unverified → Review screen → Confirm manually.
- [ ] Screenshots must show the honest labels ("Unverified", "Review needed", "Notification matched", "Confirmed manually") and the disclosure line. No "verified", no percentages, no GCash/GoTyme logos implying affiliation.
- [ ] Description states: not affiliated with GCash/GoTyme; does not move money; iOS cannot read other apps' notifications.
- [ ] In-app purchases: Solo/Team monthly (auto-renewable), 500-record pack (consumable, never expires). Prices set in each console; app shows storefront prices only.

## Google Play

- [ ] **Data safety**: Financial info (payment history — collected, not shared, encrypted in transit, deletable), Photos (receipt images), App info & performance (diagnostics counts). Not collected: location, contacts, device IDs.
- [ ] **Notification Listener** declaration: explain it reads only user-enabled wallet apps' incoming-payment notifications on the user's own device to reconcile sales records; permission requested in-context after consent screens. Provide a demo video of the pairing + consent flow.
- [ ] Sensitive permissions: `RECEIVE_BOOT_COMPLETED` (re-enqueue uploads), `POST_NOTIFICATIONS` (upload status). No SMS, no accessibility, no `QUERY_ALL_PACKAGES` (uses `<queries>` for the three wallet packages).
- [ ] Target SDK 36; 64-bit; signed release AAB with Play App Signing.
- [ ] Payments policy: digital goods only via Play Billing (RevenueCat). No alternative checkout.

## Apple App Store

- [ ] Guideline 3.1.1: all digital upgrades via IAP; consumable credits do not expire.
- [ ] Guideline 5.1.1: App Privacy labels — Financial Info (purchase history: no; other financial info: yes, linked), Photos, Diagnostics. Purpose strings in Info.plist for camera and photo library.
- [ ] Share extension `ph.payrecord.app.share` with App Group `group.ph.payrecord.app`; review notes explain it only stages an image for the main app.
- [ ] Clarify in review notes that notification matching requires a separate Android device; the iOS app scans/reviews only.
- [ ] Sign-in with email/password only; provide reviewer credentials; account deletion available in Settings.

## Before flipping to production

- [ ] `docs/testing.md` device matrix rows marked with results (device, OS, wallet version).
- [ ] Zero false automatic matches in the adversarial suite (`pnpm --filter @payrecord/api test`).
- [ ] `ProviderApps.KNOWN_SIGNERS` populated from a Play-installed GCash.
- [ ] Sentry scrubbing verified with a synthetic event containing an amount and phone number.
- [ ] Download URLs set in `apps/web` env; `/updates` release notes match the shipped version.
