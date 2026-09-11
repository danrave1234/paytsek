# Deployment & operations runbooks

## 1. First deployment

1. **Supabase project**: create; enable Email auth with confirmations; disable phone auth. Copy URL, anon key, service-role key, JWT secret.
2. **Migrations**: `supabase link --project-ref <ref>` then `supabase db push`. Verify buckets `proof-images` and `exports` exist and are **private**.
3. **API** (any Node 20 host: Fly, Railway, Render, a VM): set every `[DEPLOYMENT INPUT]` in `.env.example`. Generate `COLLECTOR_TOKEN_HASH_SECRET` with `openssl rand -hex 32`. Run `pnpm build && node apps/api/dist/main.js`. Health: `GET /v1/health`.
4. **Worker**: run `node apps/api/dist/worker.js` as a separate always-on process (1–3 replicas). It is idempotent and safe to restart.
5. **RevenueCat**: create the project, add App Store + Play apps, products `paytsek_solo_monthly`, `paytsek_team_monthly`, `paytsek_pack_500`, one offering. Set webhook URL `https://<api>/v1/billing/webhooks/revenuecat` with an Authorization header value equal to `REVENUECAT_WEBHOOK_AUTH_HEADER`. Put public SDK keys in the mobile `.env`.
6. **Mobile**: `eas build --profile production` (or local `expo run:*`). Fill `EXPO_PUBLIC_*` at build time. Distribute via stores/TestFlight; put URLs in `apps/web` env (`NEXT_PUBLIC_*`).
7. **Web**: deploy `apps/web` (Vercel or any Node host). Set `NEXT_PUBLIC_SITE_URL` and download URLs.
8. **Monitoring**: set `SENTRY_DSN` (API) and `EXPO_PUBLIC_SENTRY_DSN` (app). Scrubbing is enforced in `redact()`; verify no amounts/phones in events.

## 2. Rotate secrets

- `COLLECTOR_TOKEN_HASH_SECRET`: rotating invalidates **all** collector credentials (hashes no longer match). Announce, then owners re-pair. Prefer per-device rotation via `POST /v1/collector/rotate` instead.
- Supabase service-role key: rotate in dashboard, update API env, restart API + worker.
- RevenueCat webhook header: update both sides; replayed events are idempotent by id.

## 3. Incident: reconciliation lag

Symptoms: records stuck UNVERIFIED though notifications exist. Check `select status, count(*) from jobs group by 1`. If many `LEASED` with old `leased_until`, a worker died — leases expire automatically. If `DEAD`, inspect `last_error`; fix; `update jobs set status='PENDING', attempts=0 where status='DEAD' and kind='RECONCILE_RECORD'`.

## 4. Incident: collector uploads failing

Owner sees "Last seen X hours ago". On the phone: Settings → Use this phone as the payment phone shows `lastUploadError`. `COLLECTOR_CREDENTIAL_REVOKED` → re-pair. `HTTP_5xx` → API health. Notification access off → system settings. Force-stopped by OEM battery saver → whitelist the app; PayTsek never asks users to disable OS security controls.

## 5. Provider template change

Signal: `unknownTemplateCount` rising in health reports. Procedure: obtain a **redacted real sample** with app version; add to `tests/fixtures/notifications/*.json` with `provenance: REDACTED_REAL_SAMPLE`; update TS adapter and Kotlin parser in lockstep; bump parser version; run both test suites; ship. Never widen the matcher to compensate.

## 6. Retention

`PURGE_RETENTION` runs hourly from the worker: purges unlinked events past `purge_after`, deletes proof images past `retention_until`, expires exports, hard-deletes soft-deleted workspaces. Verify storage usage monthly.

## 7. Account deletion (support request)

User cannot sign in: verify identity via account email, then `DELETE /v1/me` semantics manually: remove memberships/profile (SQL), then delete the Auth user via Supabase admin API. Sole-owner workspaces must be transferred or deleted first.

## 8. Backups

Enable Supabase PITR (paid) or daily backups. Storage buckets are not covered by DB backups — enable bucket versioning/replication if image retention matters commercially.
