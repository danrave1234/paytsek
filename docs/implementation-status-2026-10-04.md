# Reliability implementation — 4 October 2026

This follows `improvement-review-2026-10-04.md`. It records engineering evidence,
not legal certification or a claim that every Android notification is delivered.

## Implemented

- Proof-first recording remains independent of notification setup. Account- and
  workspace-bound SQLite leases recover interrupted uploads, preserve unsynced
  files, and handle a lost Storage upload acknowledgement without overwriting
  objects. Older unowned local scans require explicit, live-authorized owner recovery.
- Reconnect/resume retries, shared sync/retry status, workspace-day totals and
  acknowledged-ID deduplication; bounded visible-screen evidence polling.
- Uncertain OCR amounts request confirmation. Records filters meet 48 dp;
  existing Paper, Query, Expo and semantic theme primitives remain in use.
- PayTsek listener diagnostics cannot enter the notification evidence channel.
  Existing legitimate evidence can still automatically produce a Strong match;
  ambiguity requires review. Historical synthetic events cannot be reliably
  identified from old stored payloads; do not guess-delete them.
- Server byte/hash/type/decode validation and bounded image normalization;
  duplicate-record responses now respect staff authorship restrictions.
- Actual signed-upload expiry is persisted, issuance is serialized with workspace
  deletion, and cleanup retains its manifest through expiry plus an in-flight
  margin. A 24-hour legacy-token hold supports cutover; the margin is not a
  provider transfer-time guarantee. Do not restore an unpatched public API.
- Sign-out is acknowledged only after the Auth SDK confirms local removal;
  an expired-session/offline failure remains visibly signed in with a retry
  message. SecureStore serializes cleanup and removes obsolete token chunks.
- Durable account deletion blocks old sessions, removes account access promptly,
  preserves business history, and retries Auth deletion. Unexpected legacy
  personally owned Storage objects pause for supported-API operator review.
- Revision-fenced queue acknowledgement, expiring worker leases, bounded
  retention/CSV jobs, private dependency/queue readiness, and build SHA checks.
- Frozen dependency resolution, native/database checks, serialized API delivery,
  immutable signed-APK publication and mandatory download checksum validation.
- Opt-in fixed-code monitoring only. No raw errors, requests, images, OCR,
  notification content, payer data, tokens, replay or native dumps are captured
  by this integration. Monitoring is not activated by this implementation.
- Privacy Notice, Terms and operational privacy procedures now distinguish
  implemented controls from operator/legal/registration work still outstanding.

## Verification evidence

| Check | Result |
| --- | --- |
| Contracts build and monorepo TypeScript | Passed |
| API | 90 tests passed |
| Contracts | 15 tests passed |
| Receipt parsers | 58 tests passed |
| Mobile | 44 tests passed, including real SQLite and installed Auth SDK regressions |
| CI utility regressions | Passed, including bounded malformed URI decoding |
| Android native compilation | Collector, OCR and app Kotlin compile passed |
| Native parser tests | 26 passed |
| Android JavaScript bundle | Expo/Hermes production export passed; not an installed APK/device test |
| Disposable Supabase/Postgres | Migrations, repeat application, RLS, private columns, idempotency, unique/scope-safe matching, deletion and worker leases passed |
| Web | Next production build passed; Privacy, Terms and home navigation checked in browser without console errors |
| Physical phone / iOS build | Not performed; no Android device connected, Windows host |

The device gate in `testing.md` remains required. Version 0.2.15 / Android code 34
is prepared, **not evidence of a published or device-verified APK**. Do not publish
until camera readability, account/workspace switching, process-kill recovery,
real notification matching, large text/TalkBack and OEM battery behavior pass.

## Deliberately gated or deferred

- The operator reports no registered business. The responsible person's legal
  identity, privacy lead/contact responsibility, registrations, processor terms,
  cross-border safeguards and intended markets remain unverified. See
  `privacy-operations.md`; obtain qualified Philippine advice and jurisdiction-
  specific advice before expansion. An individual may still have legal duties.
- No production bank/PSP adapter is enabled. Provider agreements and the BSP/NPC
  review are prerequisites. A notification match is not settlement confirmation.
- Twelve-month structured-record retention reports eligibility only; it does
  not automatically erase accounting/audit records. Legal-hold and merchant
  scope rules require an approved migration before deletion can be activated.
- A production backup/Storage-object restore and incident tabletop have not
  been demonstrated. The runbook is not a substitute for these exercises.
- No paid plans, new third-party service, budget pause, customer quota or billing
  collection was enabled. Infrastructure budget alerts need a chosen budget and
  recipient. Confirm host-plan commercial-use eligibility with the provider.
- Existing launcher Scan shortcut, scanner-on-launch and optional stable-frame
  auto-capture remain the fast-entry path. No new widget, overlapping UI kit,
  animation framework, cloud OCR, Redis/database or OTA service was added.
  Haptics, alternate lists/sheets and OTA remain measured, separately reviewed
  refinements, not assumed requirements.
- Android/wallet/OEM restrictions can delay or omit notifications. Neither
  battery guidance nor a passing local listener diagnostic guarantees delivery.

See `runbooks.md` for scheduler activation, failed deletion handling, operational
monitoring and restore procedures. Production deployment and APK publication
must each be verified independently; a local build does not establish either.
