# PayTsek repository guide

## Product constraints

- PayTsek is an Android-first payment-recording tool. It records payment proofs first; notification matching is supplementary evidence, never a reason to discard a record.
- The current product is a **free public beta**. Do not expose plans, checkout, renewal, usage quotas, credits, billing ledgers, or automatic charges. `BETA_MODE` must remain the server-side source of truth: it prevents record metering and billing writes, not merely the UI.
- Keep normal operational/audit history for records, corrections, matching and security. Do not reintroduce quota/usage tracking during beta.
- Never log raw wallet notification text or unmasked sender information outside the restricted ingestion flow.
- Record lists may display only facts PayTsek actually has from the proof or matching system: transaction time, evidence status, amount, and payment source. Never invent or infer customer names, products, categories, or notes for presentation.
- User-facing evidence labels are **Recorded**, **Possible match**, **Strong match**, **Owner confirmed**, and **Voided**. A Strong match is notification evidence, not confirmation from a bank or wallet provider.
- A proof record does not require a receiving-wallet source. `payment_records.source_id` stays nullable until supplementary evidence identifies a receiving source; never block or delay local proof persistence on notification or connector setup.
- On the signed-in owner’s Android phone, wallet listening is configured directly from Settings with per-provider toggles. Pairing codes are only for a separate payment phone. One active source row per workspace/provider is enforced by the database.
- Listener diagnostics are local-only, content-free checks. Never impersonate a wallet package, enqueue diagnostic evidence, or use diagnostics for matching. Historical synthetic events from older clients cannot be safely identified by guessing.

## V2 technical direction

- Keep the existing TypeScript monorepo, Expo/React Native mobile application, Next.js web application, Nest API, native OCR/collector modules, GitHub repository, Vercel projects, domains, and package identity.
- Supabase remains the platform for Auth, Postgres, and private proof storage. Do not introduce a second authentication system or database without an explicit architecture decision.
- Prefer current stable, security-patched versions compatible with the repository. Do not adopt canary or release-candidate dependencies merely because they are newer.
- Keep request/response validation in `@paytsek/contracts`. Screens must not maintain handwritten copies of API types.
- Keep matching, parsing, idempotency, authorization, retention, and audit rules in testable domain/server code. UI labels never replace server enforcement.
- Keep the wallet that issued a customer's receipt separate from the seller wallet that received the payment. Receipt-provider classification may use proof OCR/layout; only an allowlisted Android notification package or a server-bound signed provider connector identifies the receiving wallet. Never let one silently substitute for the other.
- Signed provider/PSP evidence is optional and supplementary. A connector is bound on the server to one workspace receiving source, accepts only a strict minimal HMAC-signed payload, and must preserve reversals and audit history. Do not enable a production adapter without a written provider agreement plus the documented BSP and NPC/privacy reviews.
- Preserve privacy-safe provider-classifier method, confidence, candidate scores, and signal codes with OCR provenance. Raw OCR text remains restricted evidence and must never be copied into classifier signal codes, logs, or analytics.

## Authentication and privacy

- The V2 sign-in hierarchy is Google first, then an explicitly opened email/password flow. Keep password reset, email verification, account deletion, Terms, and Privacy Notice reachable with minimal copy.
- Store the Supabase mobile session only through the existing SecureStore-backed client. Never put access tokens, refresh tokens, OAuth codes, or reset links in AsyncStorage, SQLite, logs, analytics, URLs beyond the one-time callback, screenshots, or error reports.
- OAuth and deep-link return URLs use an exact allowlist. Production OAuth branding must use the PayTsek name, logo, support address, privacy notice, and verified `paytsek.online` domain.
- Authentication proves identity only. Every API operation must still authorize the current workspace membership and role on the server.
- Validate file bytes, size, decode success, and allowed types before finalizing proof uploads. Private proof access uses short-lived signed URLs.
- Account deletion commits a durable request and blocks existing API sessions before retrying Supabase Auth deletion. Preserve workspace ledger/audit rows with nullable authors; sole owners must transfer ownership or delete the workspace first. Never mutate Supabase Storage metadata to force identity deletion; legacy personal object ownership requires reviewed supported-API handling.
- Structured-record retention is currently a 12-month eligibility report, not an activated purge. Do not enable historical deletion without reviewed scope, legal-hold rules and merchant notice. Operational object expiry remains separate.
- Maintain a privacy impact assessment, retention schedule, data-subject request procedure, subprocessor list, NPC registration analysis, and 72-hour breach-assessment runbook before public beta scale.
- The operator confirmed no registered business; actual operator/legal identity and privacy contacts remain unverified. Do not invent registration or compliance claims. Optional Sentry monitoring and production provider connectors remain disabled pending the gates in `docs/privacy-operations.md`.

## Mobile UI and interaction rules

- Primary navigation is **Today**, **Records**, center **Scan**, **Analytics**, and **Settings**. Keep Scan in the center and visually distinct; do not hide Settings behind another entry point.
- Analytics may group only recorded amount/count by time, the provider read from the proof, and evidence state. Do not infer customer, product, or category analytics.
- Record filters are evidence and the provider read from the proof. Search is limited to visible provider labels and exact amounts; do not surface or search hidden payer data.
- Use the checked-in provider artwork for GCash, Maya, GoTyme, and MariBank. Unknown/custom sources fall back to the neutral wallet mark. Keep `assets/providers/SOURCES.md` current when artwork changes.
- The Today header uses the checked-in text-only PayTsek wordmark. Workspace switching remains in Settings/workspace flows; do not put a workspace subtitle under the wordmark.
- Scan is the center action and must remain visually distinct, accessible, and at least 48 dp. It uses the PayTsek receipt/QR aperture treatment, not a generic oversized floating circle.
- Support System, Light, and Dark modes from the same semantic tokens. Resolve the saved/system theme before hiding the native splash to prevent a color flash.
- Prefer typography, spacing, alignment, dividers, and compact sheets over card grids. Avoid nested cards, pill-shaped everything, glass, decorative gradients, mascot loading screens, oversized greetings, and marketing copy inside operational screens.
- Ask only for missing or uncertain required fields. If OCR confidently provides the amount, persist locally without a form whether or not notification listening is configured.
- Use restrained motion for press feedback, capture settling, save confirmation, and evidence insertion. Honor the system reduced-motion setting and do not add a second animation framework for decoration.
- Status must never rely on color alone. Support large text, screen readers, keyboard/focus behavior where relevant, and 48 dp Android / 44 pt iOS targets.

## Time and offline rules

- Store and treat separately: device wall-clock time with IANA timezone, monotonic device elapsed time/boot context, receipt transaction time with precision, and server-received time.
- Default a new workspace timezone from the phone, normally `Asia/Manila`, and let the owner change it. Historical Today groupings use the workspace timezone.
- The phone clock makes offline UI immediate but is never the sole authority for matching or security. Time alone cannot create a Strong match.
- Write a scan to app-private storage and SQLite before upload. Local persistence is success; proof upload, canonical record creation, and matching continue in the background with stable idempotency IDs.
- Unsynced scans are durable data, not cache. Cache cleanup, workspace switching, and sign-out must not accidentally delete them.
- Draft upload attempts are fenced by account/workspace scope and SQLite lease tokens. Never acknowledge stale attempts after switching accounts, delete unsynced files, or automatically assign legacy unowned drafts to a newly signed-in user. Legacy recovery requires explicit owner action and current server membership.

## Android versioning and releases

- The release source of truth is `apps/mobile/app.config.ts`.
- **Before every public APK build**, increment both:
  - `version` — user-visible semantic version, for example `0.1.15` → `0.1.16`.
  - `android.versionCode` — integer strictly greater than every previously released APK, for example `14` → `15`.
- Android rejects an update when `versionCode` is reused or lower. Never rebuild a changed APK under an existing version/tag.
- Release workflow: `.github/workflows/release-android.yml`. It reads `version` and publishes `PayTsek-v<version>.apk` to the GitHub release. Required GitHub Actions variables are `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_ANON_KEY`; do not hardcode their values in source or workflow files.
- Trigger a manual release only after the release commit is pushed to `main`. Check the workflow reaches `success` before telling anyone the APK is downloadable. If a newer version supersedes an in-progress build, cancel the older run to avoid misleading “latest” releases.
- Public APK publication also requires the real-device release gate in `docs/testing.md`. CI/build success does not satisfy it; hold publication while device evidence is missing.
- Direct APK releases need the signed keystore GitHub secrets. Expo Go cannot exercise the collector/OCR native modules.
- Release gates require successful CI for the exact current-main commit, an unused version/tag and increasing versionCode. Publication verifies APK signing identity/package/version and publishes an immutable release manifest; never overwrite an existing release asset. User-facing release text comes from `apps/mobile/RELEASE_NOTES.md`.
- The app checks the latest GitHub release while active. Release bodies are user-facing in-app patch notes, and a signed APK plus SHA-256 checksum must be attached to every release.

## Deployments

There are two separate Vercel projects. Verify which project is linked before deploying:

| Surface | Vercel project | Domain | Configuration |
| --- | --- | --- | --- |
| API | `paytsek-api` | `api.paytsek.online` | repository-root `vercel.json` |
| Web | `paytsek-web` | `www.paytsek.online`, `paytsek.online` | `apps/web/vercel.json` and Root Directory `apps/web` |

- Do not deploy the repository root while it is linked to `paytsek-web`: the API `vercel.json` then conflicts with the web project. The frontend config must remain in `apps/web/vercel.json` so Git-based web deploys do not pick up the API rewrite.
- Every push to `main` must pass CI before `.github/workflows/deploy-api.yml` applies pending migrations and deploys the matching prebuilt artifact to `paytsek-api`. The gate verifies the exact build SHA, enabled beta mode and private dependency readiness; public `/v1/health` is liveness only. `VERCEL_API_PROJECT_ID` must identify `paytsek-api`, never the web project. Use a manual root deployment only for recovery, then confirm the deployment is `Ready` and aliased to `api.paytsek.online`.
- Remote database connections and migrations verify TLS. Migrations are locked/checksummed; never edit applied SQL, disable certificate verification or automatically reverse migrations after a failed application deploy.
- Durable Postgres jobs use revision-aware inline acknowledgment and attempt-aware worker leases. Keep late triggers and expired-worker retries safe. The optional Supabase minute scheduler requires explicit Vault/pg_cron/pg_net setup; the daily Vercel fallback is not minute-level delivery. See `docs/runbooks.md`.
- The local `.vercel/` directory and `.env.local` are ignored. Never commit them or deployment credentials.
- A successful build is not evidence that a release workflow has succeeded; check each independently.

## Data fetching and cache rules

- Use TanStack Query in `apps/mobile/src/lib/queries.ts`; do not add global “fetch everything” startup requests.
- Query only data required by the visible screen. Home intentionally receives its summary and six recent records in a single `/v1/home` response. An open record intentionally receives detail and candidate-match state in a single `/v1/records/:id` response.
- Keep full Records paginated and fetched only when that screen is opened. Keep pairing/device polling separate because it has a different, short-lived polling lifecycle.
- Preserve durable unsynced scans in SQLite. Only inactive in-memory React Query data may be cleared.
- Today refreshes around every 30 seconds while visible and overlays pending SQLite records on the server total/feed.
- Today acknowledgments, totals and workspace-local date share a server snapshot. Use bounded pending client IDs to exclude already-acknowledged drafts even when they are outside the six recent records; never infer acknowledgments from that short feed alone.
- Records uses cursor pagination and fetches only when opened. Prefetch the next page near the end of the list; never download the full ledger at startup.
- Prefetch record detail on deliberate row interaction. Keep stale content visible during background refresh instead of replacing it with a spinner.
- Poll collector health or new evidence only while the relevant screen is visible and stop on background, timeout, or a terminal state.
- Account-scoped query/image caches must be cleared on secure sign-out. Do not clear app-private proof files until the server has acknowledged their durable record.
- CSV is the only supported export format. Date/row/byte bounds protect request processing and are not paid beta quotas; never advertise XLSX or silently return a partial ledger.

## Agent workflow

1. Read this file and any nearer `AGENTS.md` before editing.
2. Inspect the existing behavior before replacing it; do not recreate matching, parsing, idempotency, audit, or beta rules from memory.
3. Work in a vertical slice: contract/schema, server authorization, offline behavior, UI states, tests, then observability.
4. Define loading, empty, populated, offline, error, owner, and staff states for each changed screen.
5. Keep screens thin and modules focused. Prefer files around 250 lines or less when a clear responsibility split exists; do not split mechanically.
6. Add dependencies only after checking maintenance, license, security, native/build cost, and whether Expo or an installed package already provides the capability.
7. Use sanitized deterministic fixtures. Never use real proof images, notifications, payer data, phone numbers, or credentials in tests or examples.
8. Update this guide when a real architecture boundary changes. Do not document planned migrations as already complete.

## Verification and repository hygiene

Run before committing application changes:

```powershell
pnpm --filter @paytsek/contracts run build
pnpm -r run typecheck
pnpm --filter @paytsek/api test
pnpm --filter @paytsek/contracts test
pnpm --filter @paytsek/receipt-parsers test
pnpm --filter @paytsek/mobile test
node --test scripts/ci/*.test.mjs
git diff --check
```

- Do not stage `.artifacts/` or `.claude/`; they are local/user-owned working material.
- Preserve user changes in a dirty working tree. Do not reset or checkout unrelated files.
- Use the existing logos/assets and PayTsek naming (`paytsek`, `PayTsek`, `ph.paytsek.app`) for all new product-facing work.
- Required CI includes an isolated Supabase migration/idempotency/authorization test and conditional Android compilation/parser tests. Never point synthetic invariant tests at production. Passing CI is not a real-device smoke test, production restore drill or completed privacy/legal review.
