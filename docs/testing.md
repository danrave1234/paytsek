# Testing

## Automated (CI, no devices)

| Suite | Command | Covers |
| --- | --- | --- |
| Contracts | `pnpm --filter @paytsek/contracts test` | Labels/forbidden wording, plan invariants, schema strictness (integer centavos) |
| Parsers | `pnpm --filter @paytsek/receipt-parsers test` | Money, reference normalization, Manila time, flow registry, redacted current GCash push + legacy parsing, fail-closed wallet templates, receipt extraction |
| Matcher (adversarial) | `pnpm --filter @paytsek/api test` | Single safe amount+time candidate auto-matches; multiple providers/candidates, edited fields, already-linked events, failed/pending proofs and owner-approval cases require review; delayed exact-ID and capture-time fallback remain covered |
| Kotlin parity | `cd apps/mobile/android && ./gradlew :payment-collector:testDebugUnitTest` | Same fixtures as the TS GCash adapter |
| Mobile durability | `pnpm --filter @paytsek/mobile test` | SQLite leases/restart, account/workspace fencing, offline workspace cache, interrupted uploads, workspace-day totals, bounded polling and APK checksum refusal |
| Delivery guards | `node --test scripts/ci/*.test.mjs` | Immutable versions, verified TLS, historical migration checksums, diagnostic origin and decoder backport |
| Database integration | CI `database` job / `node scripts/ci/database-invariants.mjs` against its disposable service | Real RLS, private-column privileges, record/match uniqueness and scope, deletion tombstones, queue revisions and leases |

**Synthetic fixtures do not demonstrate real GCash notification coverage.** Each fixture file records `provenance: SYNTHETIC`. Replace with `REDACTED_REAL_SAMPLE` entries (with app version and platform) before treating a flow as production-verified.

## Database-level tests (requires local Supabase)

Use the isolated service configured in `.github/supabase/config.toml` and the CI
database job's commands. Never reset a developer or production database to run
these tests. The runner applies migrations twice and rolls synthetic transaction
fixtures back. The following invariants are also useful for scoped diagnosis:

- Two inserts into `payment_matches` with the same `event_id` and `active = true` → second fails (`payment_matches_one_active_per_event_idx`).
- Create the same record twice with the same client record ID → one canonical record and a deduplicated response; public beta must not create a usage entry or block either request.
- Insert into `payment_matches` joining a record and an event from different sources → trigger `check_match_scope` raises.
- As `authenticated` role with a cashier JWT: `select * from notification_events` → 0 rows (owner-only policy); `select credential_hash from devices` → permission denied.

## Real-device end-to-end (manual, required before release)

Prereqs: two Android phones (one receives real GCash notifications), one iPhone, a development build on each, API + worker running, `.env` configured.

| # | Scenario (brief §16) | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| 1 | Same Android phone scans + collects | Owner enables provider in Settings on their signed-in phone; scan receipt; receive real GCash payment | One record, one event; a sole safe exact-amount/time candidate becomes MATCHED_AUTO without a manual tap | ☐ untested on real GCash |
| 2 | iPhone scanner + distant Android collector (mobile data) | Owner code on iPhone, enter on Android over LTE | Approval flow completes without LAN | ☐ |
| 3 | All-iPhone workspace | Skip pairing | Settings shows manual mode; no collector UI pretends to work | ☐ |
| 4 | Notification before scan | Receive first, scan later | Record automatically becomes Strong match when the existing event is the sole safe candidate | ☐ |
| 5 | Notification after scan | Scan first, receive later | Record automatically becomes Strong match after ingestion/reconciliation when the new event is the sole safe candidate | ☐ |
| 6 | Payer absent, payee present | Receipt with "Sent to" only | payee_name filled, payer null, never compared to notification sender | ✔ unit |
| 7 | Same amount / masked / time only | Two receipts, one event, no ref in notification | One record may claim the event; the other remains REVIEW_REQUIRED and the event is never linked twice | ✔ unit |
| 8 | Current GCash push without reference | Receipt has Ref; notification has amount + sender number only | MATCHED_AUTO when it is the sole safe candidate; REVIEW_REQUIRED when ambiguous | ✔ unit / ☐ device |
| 9 | Cross-provider refs differ | GoTyme receipt vs GCash notification | References are never compared; one safe amount/time candidate may still MATCHED_AUTO | ✔ unit |
| 10 | Three same-amount payments | 3 events, 1 record | 3 distinct candidates sorted by Δt | ✔ unit |
| 11 | Two cashiers claim one event | Confirm from two phones within 1 s | One MATCHED_BY_USER, one MATCH_CONFLICT | ☐ (DB constraint verified) |
| 12 | Same receipt scanned repeatedly | Same image bytes / same clientRecordId | One record, `deduplicated: true`; no beta usage charge | ☐ |
| 13 | Same notification updated/grouped | GCash updates text / groups | One event (lifecycle key), summary ignored | ☐ needs real GCash |
| 14 | Provider reuses notification key | Same key, different amount | AMBIGUOUS_LIFECYCLE_KEY rejection, first event preserved | ✔ ingestion logic / ☐ real |
| 15 | OTP / promo / outgoing / pending | Trigger each | Never in outbox, never uploaded | ✔ unit (Kotlin+TS) / ☐ device |
| 16 | Amount or source conflict | Edit amount after match | Reopened, REVIEW/UNVERIFIED, history kept | ✔ service logic / ☐ device |
| 17 | Collector offline then reconnects | Airplane mode 10 min | Outbox retries; no invented events | ☐ |
| 18 | Scanner offline | Airplane mode, scan | Draft saved, "Saved on this phone", syncs on resume | ☐ |
| 19 | Force-stop / revoke | Revoke from owner app | Uploads get 401; health shows revoked; re-pair works | ☐ |
| 20 | GCash open / notifications disabled / locked screen | Vary | Document observed behaviour here | ☐ |
| 21 | Unknown notification format | Unrelated GCash message | `unknownTemplateCount` increments, nothing stored | ☐ |
| 25 | Cross-workspace access | Cashier of A requests B's record | 403 NOT_A_MEMBER; RLS returns 0 rows | ☐ |
| 26 | Staff requests owner inbox | Cashier GET /v1/inbox | 403 OWNER_ONLY | ☐ |
| 27 | Retention / deletion | Run PURGE_RETENTION; delete account | Files removed, events purged, profile gone | ☐ |
| 28 | Auto-capture rejects ordinary text | Point camera at prices/messages and an incomplete receipt | No record; temporary probe files are removed | ☐ device |
| 29 | Auto-capture stable proof | Hold one sanitized successful proof steady | Two agreeing reads produce one local draft; manual shutter remains usable | ✔ parser gate / ☐ device |
| 30 | Signed webhook replay/tamper | Replay a valid delivery; alter body; use stale timestamp | One evidence event; tampered/stale requests rejected | ✔ signature unit / ☐ API+DB |
| 31 | Signed evidence reversal | Match a signed SUCCEEDED event, then send REVERSED | Match deactivated; proof retained; record becomes Possible match; audit preserved | ☐ API+DB |
| 32 | Listener diagnostic isolation | Run the listener check beside a receipt | Local acknowledgement only; no payment outbox event, record or match | ✔ contract/native boundary tests / ☐ device |
| 33 | Killed upload | Kill after init, PUT, finalize and record acknowledgement; restart/reconnect | Same local proof survives, upload recovers, one canonical record, no double Today amount | ✔ SQLite/sync unit / ☐ device |
| 34 | Account/workspace switch mid-upload | Switch while upload is delayed, including sign-out/sign-in as another person | Original bytes/IDs retain original scope; no cross-account preview/request/cache; retry only in the original scope | ✔ scoped unit / ☐ device |
| 35 | Offline cold launch | Previously signed-in user opens app without network, captures, then reconnects | Minimal cached workspace supports local save; current membership still checked on server; no startup full-ledger fetch | ✔ cache/sync unit / ☐ device |
| 36 | Midnight and timezone | Leave an unsynced yesterday proof; capture today, sync and reopen Today | Workspace-local date governs all totals and charts; server acknowledgement prevents handoff double-counting | ✔ unit / ☐ device |
| 37 | UI and receipt quality | System/light/dark, large text, TalkBack, rotated/high-resolution sanitized receipts | Legible amounts/images, meaningful focus/status labels, no clipped critical actions; uncertain amounts prompt | ☐ device |

Record outcomes (device model, OS, GCash version) in this table. **Release gate:** zero false automatic matches across rows 6–10 and 14 on device, plus rows 11, 12, 15, 19, 25, 26 passing.

## Metrics to watch after launch

Automatic coverage rate, manual-review rate, parse failures (`unknownTemplateCount`), OCR correction rate (`edited_fields`), delivery lag (`server_received_at - posted_at`), duplicate warnings, cloud cost per saved record. None of these collect notification text.
