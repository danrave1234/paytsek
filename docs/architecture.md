# Architecture

```
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │  Scanner phone (iOS/And) │        │ Collector phone (Android)│
 │  Expo app                │        │ Expo app + Kotlin module │
 │  • camera/import/share   │        │  NotificationListener    │
 │  • conservative auto-cap │        │                          │
 │  • ML Kit OCR (on-device)│        │  → reject-first parser   │
 │  • parsers (TS)          │        │  → encrypted outbox      │
 │  • SQLite draft queue    │        │  → WorkManager upload    │
 └───────────┬──────────────┘        └───────────┬──────────────┘
             │ user JWT + workspace header       │ Collector credential (scoped)
             ▼                                    ▼
 ┌────────────────────────────────────────────────────────────────┐
 │ NestJS API  (apps/api)                                          │
 │  auth guards → zod validation → services → parameterized SQL    │
 │  /workspaces /sources /pairing /devices /collector/events        │
 │  /evidence/connectors /evidence/webhooks                          │
 │  /proofs /records /candidates /confirm-* /unlink /void           │
 │  /exports /home /me                                               │
 └───────────────┬────────────────────────────────┬───────────────┘
                 │                                │ jobs table (SKIP LOCKED)
                 ▼                                ▼
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ Supabase Postgres        │        │ Worker process (apps/api) │
 │  RLS (read-only client)  │◄──────►│  RECONCILE_RECORD/EVENT   │
 │  partial unique indexes  │        │  GENERATE_EXPORT          │
 │  record constraints      │        │  PURGE_RETENTION          │
 │  Supabase Auth, Storage  │        │  RECONCILE_ENTITLEMENT    │
 │  Realtime (scoped)       │        └──────────────────────────┘
 └──────────────────────────┘
```

## Trust boundaries

- **Mobile ↔ API**: user JWT (Supabase Auth, HS256 verified server-side) + explicit `x-paytsek-workspace`. Membership/role resolved per request; `@OwnerOnly()` on management routes.
- **Collector ↔ API**: `Authorization: Collector prc_…`. Only `/v1/collector/*`. Source identity comes from `device_bindings`, never from the payload. Revocation clears the hash → 401 `COLLECTOR_CREDENTIAL_REVOKED`.
- **Evidence provider ↔ API**: timestamped HMAC over the exact raw body. The connector is bound server-side to one workspace/source; payloads cannot choose their tenant or provider. Raw bodies are not retained.
- **Mobile ↔ Supabase**: anon key + user JWT, **read-only** RLS on `organizations, memberships, payment_sources, devices (minus credential_hash), payment_records, payment_matches`; `notification_events` owner-only. All writes go through the API. Storage buckets are private; only API-signed URLs.
- **API ↔ Supabase**: service role, server only.

## Data model highlights (`supabase/migrations`)

- `payment_records` — one canonical recorded payment; `evidence_state` is separate from client sync state.
- `notification_events` — legacy table name for incoming evidence from Android notifications and signed webhooks. Device and connector identities are mutually exclusive; lifecycle/payment IDs are unique; rows are owner-restricted and use `purge_after` for 7-day unlinked retention.
- `evidence_connectors` — owner-managed, source-scoped connector metadata. Signing secrets are derived from a server-only master key and returned only on create/rotate.
- `payment_matches` — partial unique indexes: one active per `event_id`, one active per `record_id`. Trigger `check_match_scope` enforces same org + same source.
- Legacy usage and credit tables remain in the schema for a future commercial launch. During public beta, `BETA_MODE` prevents quota reads, consumption, and billing writes.
- `jobs` — dedupe key coalescing, `lease_jobs()` with `FOR UPDATE SKIP LOCKED`, exponential backoff, DEAD after `max_attempts`.

## Matching policy v2 (`apps/api/src/matching/matcher.ts`)

AUTO requires same source (or one unambiguous source for a proof captured without one), exact currency+amount, exactly one safe event in the applicable time window, no contradictory comparable references, an event not already linked, a non-failed/non-pending proof, no user-edited matching-critical field, and no staff owner-approval gate. Exact comparable references remain the strongest path. Multiple candidates always require review. A webhook reversal/refund reopens the record for review rather than deleting it.

## Idempotency & recovery

- Client-generated UUIDs for records, proofs, events, batches. Replays return the same result and never charge twice.
- Scanner: draft persisted in SQLite before any network; sync order init → PUT → finalize → create. Records stay safely saved even while notification matching is pending.
- Collector: outbox row persisted before the listener callback returns; WorkManager retries with network constraint; reboot receiver re-enqueues; 401 stops uploads and surfaces truthfully.
- Worker: periodic `PURGE_RETENTION`; leases expire so crashed workers' jobs are reclaimed.

## Versioning

Parser ids/versions and matcher version are stored on every event/record/match so rule changes are auditable. Rule widening requires new fixtures + tests + registry entry + `docs/provider-support-matrix.md` update.
