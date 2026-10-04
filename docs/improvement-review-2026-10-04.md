# PayTsek improvement review — 4 October 2026

Reviewed commit: `e9f80b2c295693553307634fe99f80900f2df648` (v0.2.14), also the current remote main at review time.

Scope: source inspection, GitHub configuration/release checks, production health, dependency audit, and official platform documentation. No payment records, secrets, invoices, or production database contents were inspected. Findings describe code paths and deployment configuration; they are not claims of reproduced incidents on a physical phone. No application or deployment changes were made by this review.

Recommendation: retain Expo, React Native Paper, TanStack Query, Nest, Supabase, and Vercel. Invest first in trustworthy evidence, durable sync, and useful daily operations. The existing app already contains most of the proposed capabilities; its failure recovery and release verification need more work.

## Highest-priority findings

### 1. Isolate notification diagnostics from payment evidence

The Android listener rewrites PayTsek's own flagged test notification to the GCash package, skips wallet-app checks, and sends it without synthetic provenance. The server accepts the declared allowlisted package and sends the event through normal reconciliation. Consequently, a self-test can participate in a real Strong match when other matching conditions agree.

Keep the self-test local or place diagnostics in a separately validated channel that cannot produce payment evidence. Test the rejection on the server as well as the phone. This should precede broader beta distribution.

Evidence: `modules/payment-collector/android/src/main/java/ph/paytsek/collector/PayTsekNotificationListener.kt:82`, `:103`, `:145`; `packages/contracts/src/schemas/ingestion.ts:11`; `apps/api/src/ingestion/ingestion.controller.ts:45`.

### 2. Finish durable, account/workspace-bound proof sync

- A draft claimed as `UPLOADING` is excluded from subsequent claims indefinitely. Process death during upload can strand a locally saved proof. Introduce attempt ownership and expiry/restart recovery, retaining stable idempotency IDs.
- Draft requests obtain their workspace from the mutable current selection, although the draft already knows its original workspace. Switching workspaces during sync can misroute a request or cause a scope error. Bind the account/workspace to the entire attempt and its cache updates.
- Offline cold launch starts with no workspace list. A failed workspace fetch leaves capture without its prior context. Persist minimal account-scoped workspace metadata for offline UI; continue authorizing server operations normally.
- Sync reacts to save/start/resume/manual actions, but has no native connectivity listener. Wire connectivity into both TanStack and the durable queue.

Evidence: `apps/mobile/src/lib/drafts.ts:195`, `:220`; `apps/mobile/src/lib/api.ts:50`; `apps/mobile/src/lib/session.tsx:27`, `:81`; `apps/mobile/app/_layout.tsx:55`, `:111`.

Acceptance cases: kill the process after upload initialization, upload, finalization, and record acknowledgement; restart offline; switch workspace during upload; sign out and sign back in; reconnect while the app remains visible. Unsynced proofs must survive, keep their original owner/workspace, and create one canonical record.

### 3. Provide enough capacity for background jobs

The checked-in Vercel configuration schedules maintenance once daily. Each drain handles at most 25 jobs or eight seconds. Records and notifications enqueue reconciliation even when inline reconciliation subsequently succeeds; those queued jobs remain. Exports only enqueue work. Without an independently deployed worker, a small daily volume can build a backlog that delays exports, retries, and retention.

Use the existing Postgres queue with frequent, bounded, authenticated draining and queue-age/failure monitoring. Make inline success and queued-job acknowledgement race-safe. Keep retention from starving behind reconciliation. Confirm whether a separate worker exists before changing production scheduling.

Vercel Hobby permits daily cron; Pro permits minute-level cron. Supabase Cron is another option within the existing platform, provided credentials, execution limits, and retries are handled properly. An in-process callback after a serverless response is insufficient as the sole durability guarantee. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Supabase Cron](https://supabase.com/docs/guides/cron).

Evidence: `vercel.json:10`; `apps/api/src/jobs/worker.service.ts:66`; `apps/api/src/matching/reconcile.service.ts:67`; `apps/api/src/operations/operations.controller.ts:190`.

### 4. Make Today and day-close figures trustworthy

Today adds every unsynced draft to its total and hourly chart without restricting drafts to today's workspace-local date. A prior day's pending proof can inflate today's total. The day-close evidence breakdown also omits those pending amounts. Optimistic sync updates need the same date restriction.

Centralize workspace-day aggregation and local/server handoff deduplication. Keep saved-on-phone status separate from evidence status. Analytics must retain Unknown for an unclassified receipt provider rather than substituting the receiving-wallet provider.

Evidence: `apps/mobile/app/(tabs)/index.tsx:95`, `:129`, `:148`; `apps/mobile/src/lib/queries.ts:177`; `apps/api/src/operations/operations.controller.ts:136`.

### 5. Complete account deletion and proof validation

`DELETE /v1/me` removes memberships and the profile, then claims a later job will remove the Auth account. No such job or Supabase admin deletion call exists in the inspected repository. Adding that call alone would encounter restricted foreign keys on retained payment authorship. Implement a durable, auditable deletion/anonymization workflow that preserves required business records, revokes access, and reports actual completion.

Proof finalization checks storage-reported size and MIME metadata. It does not recompute the declared hash or validate image bytes/decode. Add bounded decoding, actual type/dimension validation, and checksum verification before accepting a proof.

The documented 12-month record/history retention also differs from implementation: `RETENTION_RECORDS_MONTHS` is declared but unused. Resolve the policy and preservation requirements before introducing deletion behavior.

Evidence: `apps/api/src/operations/operations.controller.ts:240`, `:311`; `apps/api/src/records/proofs.service.ts:60`; `apps/api/src/config/env.ts:68`; `apps/api/src/jobs/worker.service.ts:232`.

## UI libraries and interaction

| Choice | Recommendation | Reason |
| --- | --- | --- |
| React Native Paper, Expo Router, shared tokens | Keep and consolidate | Themes, navigation, forms, statuses, and shared screen primitives already exist. Standardize headers, filters, buttons, confirmation flows, and errors. |
| Connectivity adapter | Add one supported native adapter | Actual reconnect handling improves existing sync and query behavior. [TanStack React Native guidance](https://tanstack.com/query/latest/docs/framework/react/react-native). |
| Expo Haptics | Small optional addition | A restrained confirmation after successful local persistence gives useful feedback during repeated scanning. It must supplement visible status. [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/). |
| Bottom-sheet library | Evaluate only for a demonstrated flow problem | Existing dialogs work; a sheet can help filters/corrections. Gorhom supports keyboard and accessible interactions, but its documentation's compatibility statements require checking against the installed Reanimated 4/native stack before adoption. [Bottom Sheet](https://gorhom.dev/react-native-bottom-sheet/). |
| FlashList | Defer until profiling justifies it | Records already uses a paginated FlatList. Recycling can help a measured large-list bottleneck; it will not fix sync or totals. [FlashList](https://shopify.github.io/flash-list/). |
| Expo Image | Optional for proof viewing | Useful if profiling demonstrates a decoding/caching benefit. Private proof caches require account scoping and secure sign-out cleanup. [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/). |
| A second UI kit or animation framework | Defer | The app already has Paper plus animation primitives. More overlapping styling systems increase consistency work. |

Concrete UI work: bring Records filter targets from 38/42 dp to at least 48 dp; standardize missing/loading/offline/error states; verify TalkBack, large text, both themes, and keyboard behavior. For manual/import scans, use the parser's confidence/ambiguity signals before bypassing the correction form; a nonzero amount alone is insufficient evidence of a confident extraction.

Evidence: `apps/mobile/app/(tabs)/records.tsx:256`; `apps/mobile/app/(tabs)/scan.tsx:224`; `packages/receipt-parsers/src/receipt/extract.ts:138`; `apps/mobile/src/components/ui.tsx`; `apps/mobile/src/theme.ts`.

Any new dependency should first pass the repository's license, maintenance, security, compatibility, and native-build-cost review. The table is a selection recommendation, not approval of a specific untested version.

## CI/CD and production operations

The current API pipeline already waits for successful push CI and deploys the associated commit through migrations and a prebuilt artifact. v0.2.14's APK/checksum publication and the last production deployment succeeded. The public health endpoint responds, but only establishes application liveness.

Improve these controls:

1. Require CI on protected main. GitHub currently reports `protected: false`, with no repository rulesets found.
2. Use a frozen lockfile for Android release builds. The workflow currently permits dependency re-resolution and can overwrite published assets using `--clobber`.
3. Gate APK publication on the exact commit's successful verification; enforce tag/app-version equality, monotonic versionCode, and immutable release assets.
4. Pin Node and build tooling, cache pnpm/Gradle safely, and add native compilation/parser tests. CI currently omits native and database integration tests; mobile/web `test` scripts are placeholders.
5. Add database integration checks for authorization, unique matches, idempotency, migrations, and deletion; add a small Android smoke suite for the durable-sync acceptance cases above.
6. Add release SHA and bounded dependency readiness checks alongside public liveness. Verify the deployed revision rather than accepting a healthy old deployment.
7. Define safe migration/deployment serialization and stale-run handling. The production workflow currently cancels an in-progress run when another starts. Recovery must account for migrations already committed; rolling back application code does not roll back the database.
8. Automate dependency review. `pnpm audit --prod` reported 23 advisories: one critical, ten high, ten moderate, two low. Some paths are native build tooling despite being production dependencies. Next 16.3.5 is flagged for an ImageResponse issue fixed in 16.3.6; no `next/og`/ImageResponse usage was found in app code, so this is a patch priority, not proof the site exposes that exploit. [Maintainer advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).

For post-production visibility, integrate one crash/error tool with release/source-map tracking. Sentry configuration fields exist, but its SDK and initialization are absent. Start with scrubbed errors, queue age, sync failure counts, stale collectors, and retention execution age. Exclude proof images, raw notification/OCR text, payer data, tokens, and replay/screenshots of payment screens. [Expo Sentry integration](https://docs.expo.dev/guides/using-sentry/).

Exercise a restore procedure for both database and private proof objects. Supabase database backups cover Storage metadata, not the objects themselves. Document recovery objectives and object recovery separately. [Supabase backups](https://supabase.com/docs/guides/platform/backups).

After reliability work, evaluate Expo Updates for JavaScript/assets with compatible runtime versions and staged rollout. Collector/OCR/native dependency changes still require a new signed APK. [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

Evidence: `.github/workflows/ci.yml`; `.github/workflows/deploy-api.yml`; `.github/workflows/release-android.yml`; `apps/api/src/operations/operations.controller.ts:274`; `apps/mobile/package.json:13`; `docs/testing.md`.

## Cost efficiency

Keep on-device OCR, private direct uploads, SQLite durability, cursor pagination, and GitHub-hosted APK downloads. Prioritize these savings:

- Stop record-detail polling after a terminal state or bounded waiting period. It currently produces up to 240 requests per visible screen-hour, including redundant SQL and signed-URL generation. Repeated image downloads were not established; the UI already retains its image URL.
- Bound proof resolution and compression using readability/OCR fixtures. Current normalization re-encodes full-resolution JPEG at quality 0.92, with an allowed upload size up to 25 MiB. Measure first; do not sacrifice proof legibility to hit an arbitrary size.
- Remove redundant queue execution and retain only the audit/operational history required by the approved retention policy.
- Stream or chunk large CSV exports. The current implementation loads all matching rows and the entire output into memory; the API also accepts XLSX but generates CSV.
- Use infrastructure spend alerts and appropriate caps; do not introduce customer quotas or record metering during beta. Automatic budget pauses have an availability tradeoff. [Vercel spend controls](https://vercel.com/docs/spend-management).

Illustrative storage model, not measured usage: 100 shops × 100 proofs/day × 30 retained days × 500 KB/proof is approximately 150 GB; at 2 MB/proof it is 600 GB. The same 100 phones leaving Today visible eight hours/day at 30-second polling generates approximately 2.88 million requests/month. Preserve the required visible-screen refresh behavior; optimize the work per request and stop unnecessary detail polling first.

A published-price planning baseline for one Vercel Pro developer seat plus one Supabase Pro Micro project is approximately US$45/month before taxes, overages, domain, email, and other add-ons. This is not a quote for the user's existing accounts: plans, actual bills, and usage were not inspected. Supabase Pro starts at US$25/month; Vercel Pro lists US$20/month. [Supabase pricing](https://supabase.com/pricing), [Vercel pricing](https://vercel.com/pricing). Hobby eligibility depends on Vercel's noncommercial-use rules, not simply whether PayTsek charges its beta users. [Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines).

Evidence: `apps/mobile/src/lib/queries.ts:120`; `apps/mobile/src/lib/receipt-capture.ts:18`; `modules/receipt-ocr/android/src/main/java/ph/payrecord/ocr/ReceiptOcrModule.kt:71`; `apps/api/src/jobs/worker.service.ts:150`; `apps/web/app/download/android/route.ts`.

## Usefulness and suggested delivery sequence

The app already supports auto-capture, screenshot import, a launcher Scan shortcut, and opening the scanner on launch. Improve discovery and reliability of these before building a separate widget.

1. **Evidence and durability:** isolate diagnostics; fix stuck uploads and workspace binding; restore offline cold-start capture; correct Today totals. Include targeted state-machine, API/database, and device regression checks.
2. **Production readiness:** finish deletion/proof validation, provision durable queue draining, strengthen release gates, patch dependencies, add sanitized monitoring and restore evidence.
3. **Daily merchant workflow:** one clear sync status with pending count and Retry; a consistent capture-to-save-to-evidence transition; fast accurate day-close CSV export and sharing; a collector diagnostic that reports access, connection and last successful upload without generating payment evidence.
4. **Measured refinements:** image size/readability tuning, optional haptics, selective sheets, list profiling, then compatible OTA delivery if its recurring benefit justifies the service.

Bank/PSP adapters remain a later enhancement: the signed connector is a foundation, not a live bank feed. Keep provider agreements and documented Philippine privacy/BSP reviews as prerequisites. No extra database, Redis service, cloud OCR, full accounting module, or bank-feed claim is needed to deliver the first three phases.
