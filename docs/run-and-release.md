# Run, release, and deploy PayTsek

## Development build

PayTsek uses native notification collection and on-device OCR. Expo Go cannot
run either module.

```powershell
pnpm install
pnpm api:dev
pnpm api:worker

Copy-Item apps/mobile/.env.example apps/mobile/.env
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android --device
```

On the owner's Android phone, enable the wanted wallet providers in Settings
and grant **Notification access** through Android Settings. Pairing is only for
a separate payment phone. Proof capture works without wallet listening. A
listener test is a local diagnostic, never payment evidence; Android/provider
delivery can still be delayed or missing.

## Publish an Android APK

1. In `apps/mobile/app.config.ts`, increment both `version` and Android
   `versionCode`. `versionCode` must be greater than every shipped APK. Update
   `apps/mobile/RELEASE_NOTES.md`, the GitHub/in-app release text, in the same commit.
2. Run the checks in `AGENTS.md`, commit, and push the release commit to
   `main`.
3. Wait for **Required checks** and API deployment for that exact commit; satisfy
   the real-device release gate in [testing](testing.md). Hold public APK
   publication while that evidence is missing, even when CI/builds are green.
4. Manually run **Release Android APK** in GitHub Actions.
5. Wait for the run to succeed. The workflow publishes
   `PayTsek-v<version>.apk`, its SHA-256 checksum and `release-manifest.json`
   on the matching GitHub release. A successful build alone is not publication.

The workflow requires the Android signing secrets plus the three GitHub Actions
variables `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never place these values in source files.
The gate checks exact successful current-main CI, increasing versionCode, unused
version/tag, package metadata and the expected signing certificate. Release
assets are immutable; a failed/partial release is not permission to replace an
already published APK. Optional mobile monitoring is not enabled by this workflow.

## Production deployment

- API: Vercel project `paytsek-api`, domain `https://api.paytsek.online`.
  Successful push CI on `main` triggers `.github/workflows/deploy-api.yml`.
  It verifies the current commit/project, builds a production artifact, applies
  pending database migrations, deploys that exact artifact to `paytsek-api`,
  and verifies private readiness, actual beta mode and the deployed build SHA.
  `/v1/health` is public liveness, not proof that dependencies or jobs are healthy.
- Web: Vercel project `paytsek-web`, Root Directory `apps/web`, domains
  `https://www.paytsek.online` and `https://paytsek.online`. Pushes to `main`
  deploy it automatically. Its configuration is `apps/web/vercel.json`.

The API workflow requires GitHub environment `production-api` with environment
secrets `DATABASE_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_API_PROJECT_ID`, and `CRON_SECRET`. The project ID must belong to `paytsek-api`, never
`paytsek-web`. Runtime API values remain configured in Vercel and are pulled by
the workflow; never hardcode credentials in workflow files. `CRON_SECRET` must
match Vercel production because sensitive environment values cannot be recovered
by `vercel pull`. Optional repository-level `CRON_SECRET` enables private checks
in the production monitor. Rotate configured consumers together. If a private
database CA is required, configure its PEM as `DATABASE_SSL_CA` for migrations
and API runtime; never disable remote certificate verification.

Migration locks and SQL checksums guard repeated/concurrent application. CI
applies the complete migration set twice against disposable Supabase and tests
tenant/staff authorization, idempotency, job leases and retained authorship.
Do not run the synthetic database-invariant script against production. A legacy
migration checksum baseline requires the explicit reviewed process in
[dependency and release operations](../.github/SECURITY_TRIAGE.md).

Dependency readiness permits deploying a corrective build when an old queue is
degraded; the queue is still reported and monitored. Do not clear failed jobs to
make a check pass. The separate production monitor and weekly dependency audit
are operational checks, not an uptime SLA or evidence of successful recovery.

For manual recovery only, link the repository root to `paytsek-api` and run
`vercel --prod --yes --scope danrave1234s-projects` after applying migrations.

Do not deploy the repository root while it is linked to `paytsek-web`; the
root `vercel.json` belongs to the API. Confirm a deployment is **Ready** and
has the intended domain alias before announcing it.
Application rollback does not roll back database migrations. Preserve the prior
deployment identity and follow the [operations runbook](runbooks.md) for queue
scheduling, deletion retries, retention reports, alert verification and restore
drills. The optional minute-level Supabase scheduler is shipped but requires
explicit Vault/pg_cron/pg_net activation; no paid queue service is needed.

## Current product status

Version 0.2.15 release notes are prepared, not proof of publication. Its public
APK is held pending the documented real-device release gate; no attached Android
device or completed gate was supplied during this implementation pass.

PayTsek is a free public beta. Billing, subscriptions, checkout, renewal,
record allowances, and paid usage tracking are disabled. Do not configure a
payment provider or present paid plans until a future, explicit go-live decision.
Missing/empty `BETA_MODE` defaults to beta-safe enabled; deployment checks the
actual runtime value. Monitoring and production provider connectors remain
disabled unless their documented operator/privacy gates are completed.

The developer has confirmed no registered operating business; the actual legal
operator, address and privacy contact remain unverified. This release does not
claim BSP approval, NPC certification or completed legal compliance. See the
[privacy readiness register](privacy-operations.md) before expanding real-user
processing. Structured-record retention is a 12-month eligibility report only;
historical deletion is blocked pending reviewed scope/legal-hold rules.
