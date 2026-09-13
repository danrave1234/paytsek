# Deployment and operations runbook

## First deployment

1. Create the Supabase project and configure Google OAuth plus the production
   redirect URLs. Keep public sign-up behavior aligned with the current auth
   configuration.
2. Apply migrations with `pnpm db:migrate:direct`, then run `pnpm db:check`.
   Verify `proof-images` and `exports` are private buckets.
3. Configure all required API environment values from `.env.example` in the
   `paytsek-api` Vercel project. Deploy and confirm `GET /v1/health` through
   `https://api.paytsek.online`.
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
