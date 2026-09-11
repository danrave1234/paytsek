# Architecture

```
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │  Scanner phone (iOS/And) │        │ Collector phone (Android)│
 │  Expo app                │        │ Expo app + Kotlin module │
 │  • camera/import/share   │        │  NotificationListener    │
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
 │  /proofs /records /candidates /confirm-* /unlink /void           │
 │  /billing (RevenueCat reconcile + webhook) /exports /home /me    │
 └───────────────┬────────────────────────────────┬───────────────┘
                 │                                │ jobs table (SKIP LOCKED)
                 ▼                                ▼
 ┌──────────────────────────┐        ┌──────────────────────────┐
 │ Supabase Postgres        │        │ Worker process (apps/api) │
 │  RLS (read-only client)  │◄──────►│  RECONCILE_RECORD/EVENT   │
 │  partial unique indexes  │        │  GENERATE_EXPORT          │
 │  consume_record_quota()  │        │  PURGE_RETENTION          │
 │  Supabase Auth, Storage  │        │  RECONCILE_ENTITLEMENT    │
 │  Realtime (scoped)       │        └──────────────────────────┘
 └──────────────────────────┘
```

## Trust boundaries

- **Mobile ↔ API**: user JWT (Supabase Auth, HS256 verified server-side) + explicit `x-paytsek-workspace`. Membership/role resolved per request; `@OwnerOnly()` on management routes.
- **Collector ↔ API**: `Authorization: Collector prc_…`. Only `/v1/collector/*`. Source identity comes from `device_bindings`, never from the payload. Revocation clears the hash → 401 `COLLECTOR_CREDENTIAL_REVOKED`.
- **Mobile ↔ Supabase**: anon key + user JWT, **read-only** RLS on `organizations, memberships, payment_sources, devices (minus credential_hash), payment_records, payment_matches`; `notification_events` owner-only. All writes go through the API. Storage buckets are private; only API-signed URLs.
- **API ↔ Supabase**: service role, server only.

## Data model highlights (`supabase/migrations`)

- `payment_records` — one canonical recorded payment; `evidence_state` is separate from client sync state.
- `notification_events` — unique `(device_id, client_event_id)` and `(source_id, lifecycle_dedup_key)`; owner-restricted; `purge_after` for 7-day retention.
- `payment_matches` — partial unique indexes: one active per `event_id`, one active per `record_id`. Trigger `check_match_scope` enforces same org + same source.
- `usage_ledger` / `credit_ledger` — exactly-once by record and by store transaction id; `consume_record_quota()` serializes per org with `quota_locks`.
- `jobs` — dedupe key coalescing, `lease_jobs()` with `FOR UPDATE SKIP LOCKED`, exponential backoff, DEAD after `max_attempts`.

## Matching policy v1 (`apps/api/src/matching/matcher.ts`)

AUTO requires: same source (query scope) · exact currency+amount · reference on both sides in **registry-comparable** namespaces with equal normalized values · exactly one such unlinked event · receipt status not FAILED/PENDING · no user-edited matching-critical field · no owner-approval requirement. Otherwise REVIEW (scoped, masked candidates) or NONE. Delayed exact-ID matches are allowed and labelled `DELAYED_EXACT_REFERENCE`. Cross-provider namespaces are never compared (`packages/receipt-parsers/src/registry.ts`).

## Idempotency & recovery

- Client-generated UUIDs for records, proofs, events, batches. Replays return the same result and never charge twice.
- Scanner: draft persisted in SQLite before any network; sync order init → PUT → finalize → create; quota exhaustion keeps the draft labelled locally.
- Collector: outbox row persisted before the listener callback returns; WorkManager retries with network constraint; reboot receiver re-enqueues; 401 stops uploads and surfaces truthfully.
- Worker: periodic `PURGE_RETENTION`; leases expire so crashed workers' jobs are reclaimed.

## Versioning

Parser ids/versions and matcher version are stored on every event/record/match so rule changes are auditable. Rule widening requires new fixtures + tests + registry entry + `docs/provider-support-matrix.md` update.
