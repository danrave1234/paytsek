# Deployment and operations runbook

## First deployment

1. Create the Supabase project and configure Google OAuth plus the production
   redirect URLs. Keep public sign-up behavior aligned with the current auth
   configuration.
2. Apply migrations with `pnpm db:migrate:direct`, then run `pnpm db:check`.
   Verify `proof-images` and `exports` are private buckets.
3. Configure all required API environment values from `.env.example` in the
   `paytsek-api` Vercel project. Configure the `production-api` GitHub
   environment and its deployment secrets as described in `run-and-release.md`.
   Push to `main`, wait for **Deploy API** to succeed, and confirm
   `GET /v1/health` through `https://api.paytsek.online`.
4. Configure the web project's public API and Supabase environment values,
   then confirm `https://www.paytsek.online` is serving the current commit.
5. Build an Android APK through the GitHub release workflow. Verify Google
   sign-in, source pairing, a proof scan, and one notification sync on-device.

## Current beta policy

The service is in free public beta. Do not add PayMongo, RevenueCat, paid
plans, checkout links, renewal jobs, credits, or quota enforcement. The API's
`BETA_MODE` keeps billing and record metering inactive.

## Incident: notification matching is delayed

1. Confirm the record was saved; a payment record remains valid while
   unverified.
2. In the app, check the paired payment phone's last contact and notification
   access state.
3. On the payment phone, ensure Android notification access is still enabled
   and the app was not force-stopped or restricted by battery optimization.
4. Check API health and collector upload errors. Re-pair only when the device
   credential was revoked or the source binding is no longer active.

## Provider template change

Obtain a redacted sample and its wallet-app version. Add a labelled fixture,
update the TypeScript adapter and Kotlin parser together, run parser tests, and
ship a new Android version. Do not widen automatic matching rules merely to
accept an unfamiliar message.

## Retention and account deletion

The maintenance job removes expired exports, proof images past their retention
period, and unlinked notification events past their purge date. Handle account
deletion through the authenticated API flow; sole owners must transfer or
delete their workspace first.

Deletion now creates a durable `DELETE_ACCOUNT` job and removes memberships in
the same transaction. Track `account_deletions` until COMPLETE; FAILED is an
operator incident, not successful erasure. See [privacy operations](privacy-operations.md)
for scoped erasure, retained workspace records and backup copies. Structured
record retention is a count-only dry run; automatic historical deletion cannot
be enabled by changing an environment variable.

## Queue scheduling (without adding a queue service)

The existing Postgres jobs table is authoritative. Inline reconciliation marks
only its own job revision complete; later triggers remain queued. Vercel's daily
maintenance fallback is not a reliable minute-level worker scheduler.

In the existing Supabase project, an authorized operator should enable `pg_cron`
and `pg_net`, then set Vault secrets `paytsek_api_url` (exact HTTPS API origin)
and `paytsek_cron_secret` (same random secret as the API's `CRON_SECRET`). Never
paste secret values into GitHub issues, CLI arguments or SQL logs. With those
secrets provisioned, call `select configure_paytsek_job_schedule();` through a
privileged connection. This installs one idempotently named minute-level drain.
Verify `cron.job`, recent `cron.job_run_details`, private readiness queue state,
and actual job completion; an HTTP enqueue alone is not successful processing.

Disable with `select cron.unschedule('paytsek-job-drain');` only during an
authorized incident response and restore it promptly. A failed queue/deletion
job needs scoped investigation and replay after its cause is repaired. Never
mark all jobs DONE or delete failed jobs to turn readiness green.

## Liveness, readiness and operational alerts

`GET /v1/health` is public liveness with build SHA. Private readiness uses the
existing cron Bearer secret and checks DB/schema/private storage/queue state.
Deployment verifies the exact commit plus dependency readiness; operational
monitoring also flags a degraded queue. Neither check exposes records or tokens.
The GitHub production-monitor workflow checks public endpoints every 15 minutes;
adding the repository `CRON_SECRET` secret enables private readiness. GitHub
scheduled jobs can be delayed and are not an uptime SLA. Verify account Actions
failure notifications reach the operator; do not claim alerts are working without
a controlled failure/recovery drill.

Sentry is optional, manually instrumented and **off by default**. Enable the
server/mobile flags only after the [privacy gate](privacy-operations.md). Events
are rebuilt from four fixed codes plus release and surface, with no request,
exception text, user, amount, URL, screenshot, replay, native dump or breadcrumb.
Automatic tracing/source-map upload is not configured. It is not full native
crash coverage. No SDK field is a substitute for testing the outgoing event.

## Backups and restore drill

A database backup does **not** include private Storage object bytes. Verify the
actual Supabase plan's backup/PITR provisions; do not assume a free project has
production recovery coverage. See [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).
No paid plan, backup destination or retention period is authorized just by this
runbook.

Before beta expansion, record a named backup owner, approved encrypted backup
destination, least-privilege access, retention/legal-hold rules, and RPO/RTO
targets. Back up database + Auth dependencies + proof/export object manifest
and required object bytes. Never upload real backups as CI artifacts or into Git.

Perform a restore in an isolated non-production project:

1. Select the approved backup and record its age, integrity digest and start time.
2. Restore schema/data and approved object bytes privately; prevent outbound
   notifications, webhooks, cron, billing and new evidence connectors.
3. Reapply deletion requests/expired-object policies after the backup timestamp
   before granting any user access. Do not resurrect deleted identities or proofs.
4. Verify owner/staff/cross-workspace denial, proof hashes, private buckets,
   exact record totals, source-null records, idempotency and queue recovery with
   restricted access. Use synthetic accounts where possible.
5. Record recovered timestamp, object coverage, elapsed time, discrepancies,
   remediation and reviewer. Remove the isolated restore via approved cleanup.

CI's disposable Supabase tests validate migrations and synthetic invariants;
they are **not** evidence that a production backup was restored. Last production
restore evidence: not supplied. Last breach tabletop evidence: not supplied.

## Spend and rollout controls

Keep local OCR, bounded image decode, on-screen queries, bounded export batches
and the existing database queue. Retain Paper/Query/Expo; there is no second UI
kit, cloud OCR, database, Redis or paid feature gate. Configure provider budget
alerts only after the operator selects a monthly budget and alert recipient.
An automatic spend pause is an availability decision and must be explicitly
approved; local capture should remain usable when the backend is unavailable.

Do not turn on OTA updates until there is a reviewed Expo project/channel,
native runtime fingerprint policy, rollback drill and cost/privacy approval.
Native collector/OCR changes still require a new signed APK. Optional haptics,
replacement lists and bottom-sheet libraries need measured benefit and device
accessibility/performance verification before being dependencies.

## Legacy listener-test evidence

Older app versions generated GCash-shaped diagnostic events without provenance.
Already uploaded events cannot reliably be distinguished from genuine events
using their stored fields. Do not guess and delete ledger history. If a merchant
used that old diagnostic, review the relevant records with them and correct/void
through audited flows. New diagnostics never reach the outbox/matcher; no change
here certifies the authenticity of historical notifications.
