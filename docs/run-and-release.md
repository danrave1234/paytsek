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

On the Android phone used as the payment phone, grant **Notification access**
to PayTsek through Android Settings. The app only collects supported incoming
payment notifications after the owner has paired the phone to a payment source.

## Publish an Android APK

1. In `apps/mobile/app.config.ts`, increment both `version` and Android
   `versionCode`. `versionCode` must be greater than every shipped APK.
2. Run the checks in `AGENTS.md`, commit, and push the release commit to
   `main`.
3. Manually run **Release Android APK** in GitHub Actions.
4. Wait for the run to succeed. The workflow publishes
   `PayTsek-v<version>.apk` on the matching GitHub release.

The workflow requires the Android signing secrets plus the three GitHub Actions
variables `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never place these values in source files.

## Production deployment

- API: Vercel project `paytsek-api`, domain `https://api.paytsek.online`.
  From the repository root, link that project and deploy with
  `vercel --prod --yes --scope danrave1234s-projects`.
- Web: Vercel project `paytsek-web`, Root Directory `apps/web`, domains
  `https://www.paytsek.online` and `https://paytsek.online`. Pushes to `main`
  deploy it automatically. Its configuration is `apps/web/vercel.json`.

Do not deploy the repository root while it is linked to `paytsek-web`; the
root `vercel.json` belongs to the API. Confirm a deployment is **Ready** and
has the intended domain alias before announcing it.

## Current product status

PayTsek is a free public beta. Billing, subscriptions, checkout, renewal,
record allowances, and paid usage tracking are disabled. Do not configure a
payment provider or present paid plans until a future, explicit go-live decision.
