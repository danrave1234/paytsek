# Testing

## Automated (CI, no devices)

| Suite | Command | Covers |
| --- | --- | --- |
| Contracts | `pnpm --filter @payrecord/contracts test` | Labels/forbidden wording, plan invariants, schema strictness (integer centavos) |
| Parsers | `pnpm --filter @payrecord/receipt-parsers test` | Money, reference normalization, Manila time, flow registry, GCash adapter (SYNTHETIC fixtures), GoTyme fail-closed, receipt extraction (payer/payee separation, fee vs amount) |
| Matcher (adversarial) | `pnpm --filter @payrecord/api test` | Every rule in §6 of the brief: amount+time never auto, cross-provider never maps, 3 same-amount → distinct candidates, delayed exact-ID, edited fields, already-linked, failed/pending, owner approval, capture-time fallback |
| Kotlin parity | `cd apps/mobile/android && ./gradlew :payment-collector:testDebugUnitTest` | Same fixtures as the TS GCash adapter |

**Synthetic fixtures do not demonstrate real GCash notification coverage.** Each fixture file records `provenance: SYNTHETIC`. Replace with `REDACTED_REAL_SAMPLE` entries (with app version and platform) before treating a flow as production-verified.

## Database-level tests (requires local Supabase)

Run `supabase start && supabase db reset`, then with `psql "$DATABASE_URL"`:

- Two inserts into `payment_matches` with the same `event_id` and `active = true` → second fails (`payment_matches_one_active_per_event_idx`).
- `select consume_record_quota(org, rec, user)` twice for the same record → `'MONTHLY'` then `'ALREADY'`; 51st record on FREE without credits → `'NONE'`.
- Concurrent quota: two sessions calling `consume_record_quota` for different records at the 50th unit → exactly one `'MONTHLY'`, one `'NONE'` (row lock on `quota_locks`).
- Insert into `payment_matches` joining a record and an event from different sources → trigger `check_match_scope` raises.
- As `authenticated` role with a cashier JWT: `select * from notification_events` → 0 rows (owner-only policy); `select credential_hash from devices` → permission denied.

## Real-device end-to-end (manual, required before release)

Prereqs: two Android phones (one receives real GCash notifications), one iPhone, a development build on each, API + worker running, `.env` configured.

| # | Scenario (brief §16) | Steps | Expected | Status |
| --- | --- | --- | --- | --- |
| 1 | Same Android phone scans + collects | Pair phone as BOTH; scan receipt; receive real Express Send | One record, one event, state MATCHED_AUTO only if reference present on both | ☐ untested on real GCash |
| 2 | iPhone scanner + distant Android collector (mobile data) | Owner code on iPhone, enter on Android over LTE | Approval flow completes without LAN | ☐ |
| 3 | All-iPhone workspace | Skip pairing | Settings shows manual mode; no collector UI pretends to work | ☐ |
| 4 | Notification before scan | Receive first, scan later | Record picks up existing event as candidate/match | ☐ |
| 5 | Notification after scan | Scan first, receive later | Record updates after worker runs (realtime/refetch) | ☐ |
| 6 | Payer absent, payee present | Receipt with "Sent to" only | payee_name filled, payer null, never compared to notification sender | ✔ unit |
| 7 | Same amount / masked / time only | Two receipts, one event, no ref in notification | REVIEW_REQUIRED, never AUTO | ✔ unit |
| 8 | Valid shared namespace + exact ID | Receipt Ref = notification Ref | MATCHED_AUTO with disclosure text | ✔ unit / ☐ device |
| 9 | Cross-provider refs differ | GoTyme receipt vs GCash notification | NO_COMPARABLE_NAMESPACE, no auto | ✔ unit |
| 10 | Three same-amount payments | 3 events, 1 record | 3 distinct candidates sorted by Δt | ✔ unit |
| 11 | Two cashiers claim one event | Confirm from two phones within 1 s | One MATCHED_BY_USER, one MATCH_CONFLICT | ☐ (DB constraint verified) |
| 12 | Same receipt scanned repeatedly | Same image bytes / same clientRecordId | One record, one usage charge, `deduplicated: true` | ☐ |
| 13 | Same notification updated/grouped | GCash updates text / groups | One event (lifecycle key), summary ignored | ☐ needs real GCash |
| 14 | Provider reuses notification key | Same key, different amount | AMBIGUOUS_LIFECYCLE_KEY rejection, first event preserved | ✔ ingestion logic / ☐ real |
| 15 | OTP / promo / outgoing / pending | Trigger each | Never in outbox, never uploaded | ✔ unit (Kotlin+TS) / ☐ device |
| 16 | Amount or source conflict | Edit amount after match | Reopened, REVIEW/UNVERIFIED, history kept | ✔ service logic / ☐ device |
| 17 | Collector offline then reconnects | Airplane mode 10 min | Outbox retries; no invented events | ☐ |
| 18 | Scanner offline | Airplane mode, scan | Draft saved, "Saved on this phone", syncs on resume | ☐ |
| 19 | Force-stop / revoke | Revoke from owner app | Uploads get 401; health shows revoked; re-pair works | ☐ |
| 20 | GCash open / notifications disabled / locked screen | Vary | Document observed behaviour here | ☐ |
| 21 | Unknown notification format | Unrelated GCash message | `unknownTemplateCount` increments, nothing stored | ☐ |
| 22 | Quota exhausted after save | Set FREE allowance reached | Matching continues; new scans stay drafts | ☐ (SQL verified) |
| 23 | Duplicate / forged billing webhook | Replay event id; bad Authorization | Idempotent; 401 | ☐ needs RevenueCat sandbox |
| 24 | Refund / restore / cancel | RevenueCat sandbox | Entitlement correct; records retained | ☐ |
| 25 | Cross-workspace access | Cashier of A requests B's record | 403 NOT_A_MEMBER; RLS returns 0 rows | ☐ |
| 26 | Staff requests owner inbox | Cashier GET /v1/inbox | 403 OWNER_ONLY | ☐ |
| 27 | Retention / deletion | Run PURGE_RETENTION; delete account | Files removed, events purged, profile gone | ☐ |

Record outcomes (device model, OS, GCash version) in this table. **Release gate:** zero false automatic matches across rows 6–10 and 14 on device, plus rows 11, 12, 15, 19, 25, 26 passing.

## Metrics to watch after launch

Automatic coverage rate, manual-review rate, parse failures (`unknownTemplateCount`), OCR correction rate (`edited_fields`), delivery lag (`server_received_at - posted_at`), duplicate warnings, cloud cost per saved record. None of these collect notification text.
