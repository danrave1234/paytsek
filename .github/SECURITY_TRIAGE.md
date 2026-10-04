# Dependency and release operations

The weekly production dependency audit fails visibly on high/critical advisories.
It is separate from required PR checks so an unrelated existing advisory does not
prevent shipping a compatible fix. A failure is a triage task, not evidence that
PayTsek has been exploited. Review the affected installed version, reachable API,
official advisory, patched release, and Expo SDK compatibility. Record the owner,
decision, mitigation, and next review date in an issue for any deferred finding.
Do not suppress all advisories or force incompatible major upgrades.

Production availability runs every 15 minutes without installing dependencies.
It retries transient errors and emits only an actionable failed check, never an
HTTP body, credential or customer event. Without a repository CRON_SECRET it
checks public API health and both website domains only. Set the optional repository
secret to the existing Vercel CRON_SECRET to include private readiness. GitHub's
Actions failure subscriptions provide notifications; scheduled runs can be delayed
and are a beta baseline, not a guaranteed real-time monitoring service.

Require the **Required checks** CI job on main. It aggregates TypeScript/mobile
tests, web build, ephemeral Supabase invariants and conditionally required native
compilation/parser tests. Dependabot opens reviewable updates, never auto-merges.

APK publication requires a new app version and versionCode, exact successful main
CI, matching tag, verified keystore signature, package metadata, checksum, and a
release manifest. Builds may be superseded; publication is serialized. Existing
release assets are never replaced. A partially uploaded draft remains private;
inspect it and publish a new incremented version rather than reusing APK identity.

Production API deploys are serialized through migrations and promotion. A stale
commit is skipped before deployment and checked again before migrations. Once a
migration commits, the matching app deployment finishes even if main advances.
Deploy readiness checks database/schema, private bucket configuration, queue state
and exact build SHA. Keep matching CRON_SECRET values in Vercel production and
the production-api GitHub environment (and repository secret for the optional
monitor). Sensitive Vercel values cannot be recovered through environment pulls;
rotate all configured consumers together without printing the credential.

Remote migrations require verified TLS. If the database uses a private CA, add
its PEM to production-api's DATABASE_SSL_CA secret; never disable verification.
Transaction advisory locks serialize migration checks/application with transaction
pooling. SQL checksums reject edits to previously applied files. Existing rows
from the old runner are verified using their stored SQL. Older CLI rows with split
or missing SQL need a one-time, operator-reviewed MIGRATION_ACCEPT_LEGACY_BASELINE
before adopting checksums. CI starts an empty isolated service and applies the
same migration runner twice, without inheriting developer database contents.

The first two 20260908 migration files deliberately retain their original
PayRecord comments and retired SOLO/TEAM store-product IDs. On 2026-10-04 a
read-only comparison of production migration history found a later branding
edit in those files; the repository SQL was restored to the exact originally
applied hashes (covered by regression tests). No migration history, database
schema or billing configuration was rewritten or baselined around the mismatch.
Billing remains disabled during beta. Any future product-ID change requires a
new reviewed forward migration, not editing historical seed SQL.

On failed readiness, inspect the previous and new deployment and queue before
promoting or rolling back. A Vercel rollback changes application routing, not the
database. Use additive/backward-compatible migrations, keep the prior deployment
ID, and test restoration of both database and private proof storage separately.
Do not automatically reverse migrations or delete customer records on failure.

## Reviewed dependency residuals — 2026-10-04

After compatible Nest/Next patches and targeted transitive overrides,
`pnpm audit --prod` reports **0 critical, 2 high, 2 moderate** (previously 23
advisories). This is not a clean audit. Maintainer/operator owns follow-up; review
again by 2026-10-11 and on the weekly audit, before dependency or OTA changes.

| Advisory | Decision and reachability |
| --- | --- |
| [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) — moderate | Expo Router's query parser is reachable. A checked-in MIT-licensed bounded decoder backport preserves its CommonJS API; actual query-string compatibility and malformed-input timeout regressions pass. Audit still flags the original package version because it does not inspect pnpm patches. Remove the patch only with a compatible upstream upgrade and these tests. |
| [node-forge](https://github.com/advisories/GHSA-86w9-cpqp-85rv) — high | Expo CLI/code-signing tooling; no PayTsek API import or activated OTA verification. Registry 1.4.1 was unavailable at review, despite the audit's suggested version. Do not force an unpublished version or describe the issue as fixed. Accept only trusted build inputs and keep OTA disabled pending a supported fix. |
| [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) — high | Metro/build glob parsing; no app feature accepts user-supplied glob patterns. Registry 3.0.4 was unavailable at review. CI inputs remain reviewed repository files with job timeouts; this is reduced exposure, not a patched dependency. |
| [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — moderate | xcode build tooling calls `uuid.v4()` without a supplied buffer; the advisory targets v3/v5/v6 buffer bounds. No affected call was identified on that path. Await compatible Expo/xcode maintenance rather than a blind major override. |

New dependencies were checked for stable compatibility and license: Expo Network
(MIT, existing Expo SDK), Sharp (Apache-2.0, bounded server decode), Sentry SDKs
(MIT, disabled by default). No Sentry CLI binary download/source-map upload or
native crash/replay collection is enabled. Any activation still needs the privacy
and processor review in `docs/privacy-operations.md`.
