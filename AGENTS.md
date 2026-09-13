# PayTsek repository guide

## Product constraints

- PayTsek is an Android-first payment-recording tool. It records payment proofs first; notification matching is supplementary evidence, never a reason to discard a record.
- The current product is a **free public beta**. Do not expose plans, checkout, renewal, usage quotas, credits, billing ledgers, or automatic charges. `BETA_MODE` must remain the server-side source of truth: it prevents record metering and billing writes, not merely the UI.
- Keep normal operational/audit history for records, corrections, matching and security. Do not reintroduce quota/usage tracking during beta.
- Never log raw wallet notification text or unmasked sender information outside the restricted ingestion flow.

## Android versioning and releases

- The release source of truth is `apps/mobile/app.config.ts`.
- **Before every public APK build**, increment both:
  - `version` — user-visible semantic version, for example `0.1.15` → `0.1.16`.
  - `android.versionCode` — integer strictly greater than every previously released APK, for example `14` → `15`.
- Android rejects an update when `versionCode` is reused or lower. Never rebuild a changed APK under an existing version/tag.
- Release workflow: `.github/workflows/release-android.yml`. It reads `version` and publishes `PayTsek-v<version>.apk` to the GitHub release. Required GitHub Actions variables are `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; do not hardcode their values in source or workflow files.
- Trigger a manual release only after the release commit is pushed to `main`. Check the workflow reaches `success` before telling anyone the APK is downloadable. If a newer version supersedes an in-progress build, cancel the older run to avoid misleading “latest” releases.
- Direct APK releases need the signed keystore GitHub secrets. Expo Go cannot exercise the collector/OCR native modules.

## Deployments

There are two separate Vercel projects. Verify which project is linked before deploying:

| Surface | Vercel project | Domain | Configuration |
| --- | --- | --- | --- |
| API | `paytsek-api` | `api.paytsek.online` | repository-root `vercel.json` |
| Web | `paytsek-web` | `www.paytsek.online`, `paytsek.online` | `apps/web/vercel.json` and Root Directory `apps/web` |

- Do not deploy the repository root while it is linked to `paytsek-web`: the API `vercel.json` then conflicts with the web project. The frontend config must remain in `apps/web/vercel.json` so Git-based web deploys do not pick up the API rewrite.
- For a production API deployment, link the root to `paytsek-api`, deploy with `vercel --prod --yes --scope danrave1234s-projects`, then confirm the deployment is `Ready` and aliased to `api.paytsek.online`.
- The local `.vercel/` directory and `.env.local` are ignored. Never commit them or deployment credentials.
- A successful build is not evidence that a release workflow has succeeded; check each independently.

## Data fetching and cache rules

- Use TanStack Query in `apps/mobile/src/lib/queries.ts`; do not add global “fetch everything” startup requests.
- Query only data required by the visible screen. Home intentionally receives its summary and six recent records in a single `/v1/home` response. An open record intentionally receives detail and candidate-match state in a single `/v1/records/:id` response.
- Keep full Records paginated and fetched only when that screen is opened. Keep pairing/device polling separate because it has a different, short-lived polling lifecycle.
- Preserve durable unsynced scans in SQLite. Only inactive in-memory React Query data may be cleared.

## Verification and repository hygiene

Run before committing application changes:

```powershell
pnpm --filter @paytsek/contracts run build
pnpm -r run typecheck
pnpm --filter @paytsek/api test
pnpm --filter @paytsek/contracts test
git diff --check
```

- Do not stage `.artifacts/` or `.claude/`; they are local/user-owned working material.
- Preserve user changes in a dirty working tree. Do not reset or checkout unrelated files.
- Use the existing logos/assets and PayTsek naming (`paytsek`, `PayTsek`, `ph.paytsek.app`) for all new product-facing work.
