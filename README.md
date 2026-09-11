# PayTsek

> Scan a payment proof, keep an organized record, and match it with incoming-payment evidence from your receiving phone.

PayTsek is a mobile MVP (Android + iOS) for Philippine sellers paid via **GCash** and **GoTyme**. A cashier scans the customer's receipt; the seller's own **Android** phone reports incoming-payment notifications; the server reconciles the two under a strict, versioned matching policy. Nothing here moves money, asks for wallet credentials, or claims provider verification.

Working name only; no trademark or domain availability is implied. Not affiliated with GCash, GoTyme, or any bank.

## Repository layout

```
apps/mobile               Expo (dev-client) app: Expo Router, React Native Paper, TanStack Query, RHF+Zod
apps/api                  NestJS API + Postgres-backed worker (reconciliation, exports, retention, billing)
apps/web                  Next.js 16 + Tailwind v4 site: home, updates, downloads, privacy, terms, support
packages/contracts        Shared enums, Zod schemas, error codes, plan limits
packages/receipt-parsers  Money/reference/time parsing, notification adapters, receipt extraction, flow registry
modules/payment-collector Expo local module (Kotlin): NotificationListenerService, encrypted outbox, WorkManager
modules/receipt-ocr       Expo local module (Kotlin+Swift): ML Kit on-device OCR, EXIF strip, iOS share extension
supabase/migrations       Reviewed SQL: schema, constraints, RLS, quotas, jobs
tests/fixtures            SYNTHETIC parser fixtures (labelled; not real provider coverage)
docs                      Architecture, testing, runbooks, provider matrix, store checklist
```

## Prerequisites

- Node 20+, pnpm 9+ (`corepack enable`)
- Supabase CLI (local dev) or a Supabase project
- Android Studio (SDK 36, JDK 17) and/or Xcode 16 for development builds — **Expo Go cannot run this app** (native modules)
- Optional: RevenueCat account + store products for billing; Sentry DSN

## Quick start (local)

```powershell
pnpm install
pnpm -r --filter ./packages/** run build      # contracts + parsers -> dist

# Database (hosted Supabase project, no CLI needed)
Copy-Item .env.example .env                    # fill SUPABASE_URL, SUPABASE_ANON_KEY (sb_publishable_...),
                                               # SUPABASE_SERVICE_ROLE_KEY (sb_secret_...), DATABASE_URL, COLLECTOR_TOKEN_HASH_SECRET
pnpm db:migrate:direct                         # applies supabase/migrations over DATABASE_URL (tables, RLS, private buckets)
pnpm db:check                                  # prints applied migrations, tables, buckets, RLS policy count

# Database (local Supabase CLI alternative)
supabase start; supabase db reset              # local Postgres/Auth/Storage + migrations

# API (reads ../../.env via node --env-file)
pnpm api:dev                                   # http://localhost:3000/v1/health
pnpm api:worker                                # separate process: reconciliation, exports, retention
pnpm db:smoke                                  # creates a confirmed test user, signs in, calls the API with the token

# Mobile (development build, not Expo Go)
Copy-Item apps/mobile/.env.example apps/mobile/.env
cd apps/mobile; npx expo prebuild; npx expo run:android   # or run:ios on macOS
npx expo start --dev-client

# Website
pnpm --filter @paytsek/web dev               # http://localhost:3001
```

## Tests

```powershell
pnpm test            # vitest: contracts, parsers (fixtures), matcher adversarial suite
pnpm typecheck
```

Kotlin parser parity tests: `cd apps/mobile/android; ./gradlew :payment-collector:testDebugUnitTest` after prebuild.
Device/E2E procedures and the acceptance matrix status are in `docs/testing.md`.

## Deployment inputs the code cannot supply

Documented, never faked. Without them the corresponding capability is visibly disabled:

| Input | Effect when missing |
| --- | --- |
| `SUPABASE_*`, `DATABASE_URL`, `COLLECTOR_TOKEN_HASH_SECRET` | API refuses to start (env validation). `SUPABASE_JWT_SECRET` is only needed for legacy HS256 projects; ES256 projects are verified via JWKS |
| `EXPO_PUBLIC_SUPABASE_*` | App shows a "not configured" screen, no demo data |
| `REVENUECAT_SECRET_API_KEY`, store product IDs, public SDK keys | Purchases disabled; server never grants paid capacity |
| Real GoTyme / merchant-QR notification samples | Those flows stay "recording + manual confirmation only" in the flow registry |
| Signing keys, store accounts, Play/App Store listings | Download page shows "not yet available" |
| Provider signing-cert pins (`ProviderApps.KNOWN_SIGNERS`) | Package identity is recorded but not pinned |

See `docs/runbooks.md` for the full deployment checklist and `docs/provider-support-matrix.md` for what auto-matches and why.

## AI-assisted development

`.mcp.json` registers the **Expo MCP server** and **Supabase MCP server** so coding agents (Claude Code, Cursor, Codex…) get live Expo docs, EAS build logs, simulator screenshots and schema inspection. Optional; see `docs/agent-tooling.md`.

## Key guarantees (enforced in code, not prose)

- Amounts are integer centavos; references are strings; timestamps keep source precision.
- Automatic match = exact comparable reference **and** exact amount **and** same source, one candidate, no contradictions. Amount + time alone never auto-confirms (`apps/api/src/matching/matcher.spec.ts`).
- One active association per event and per record via partial unique indexes; races produce one winner.
- Quota is consumed atomically with record creation in SQL (`consume_record_quota`), idempotent by client record id.
- Collector credentials are scoped, hashed at rest, and derive source identity server-side.
- OTPs, outgoing, promo, failed/pending, and unknown notifications are dropped on-device and never uploaded.
