# Run on your phone, build APKs, publish releases, deploy the website

Everything below assumes the repo root `pay_record/` and that `.env` and
`apps/mobile/.env` are filled in (Supabase URL/keys — already done).

## 1. Run the app on your Android phone (development)

The app uses native modules (notification listener, ML Kit OCR), so **Expo Go
will not work** — you need a development build installed once, after which JS
changes hot-reload over Wi‑Fi/USB.

### One-time setup on the PC
1. Android Studio → SDK Manager: Android 15/16 SDK + Platform-Tools. Make sure
   `adb` is on PATH: `%LOCALAPPDATA%\Android\Sdk\platform-tools`.
2. JDK 17 (`java -version`).
3. `pnpm install` at the repo root.

### One-time setup on the phone
1. Settings → About phone → tap *Build number* 7× → Developer options → enable
   **USB debugging**. Plug in, accept the RSA prompt. `adb devices` must list it.
2. Have GCash installed on the phone that will *receive* payments.

### Build & install
```powershell
cd apps\mobile
# point the app at the API on your PC (phone and PC on the same Wi‑Fi)
# apps\mobile\.env → EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:3000
npx expo prebuild --platform android      # generates android/ from app.config.ts
npx expo run:android --device             # compiles, installs, starts Metro
```
In another two terminals: `pnpm api:dev` and `pnpm api:worker`.

After the first install you only need `npx expo start --dev-client` and open
the PayRecord app on the phone. Re-run `expo run:android` when native code /
config plugins change.

On the receiving phone: Android Settings → Notifications → *Notification
access* → allow **PayRecord**, then in the app go to Sources and enable GCash.

### No USB cable? Build a dev APK in the cloud
```powershell
cd apps\mobile
eas build --platform android --profile development
```
Scan the QR code / open the link on the phone to install. Then run
`npx expo start --dev-client --tunnel` on the PC and open the app.

## 2. Produce a shareable APK (beta testers)

```powershell
cd apps\mobile
eas build --platform android --profile preview     # signed .apk, ~10–15 min
```
`eas.json` uses the local keystore in `apps/mobile/credentials/` (never
committed). The `preview` profile hard-codes `EXPO_PUBLIC_API_URL` — change it
to your deployed API URL (see §5) before sharing builds outside your LAN.

## 3. Automatic GitHub Releases (APK attached)

`.github/workflows/release-android.yml` builds on EAS and attaches
`PayRecord-vX.Y.Z.apk` to a GitHub Release whenever you push a `v*` tag. The
website's Download page links to the *latest* release automatically.

### Add these repository secrets once
GitHub → repo → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
| --- | --- |
| `EXPO_TOKEN` | https://expo.dev/accounts/danrave1234/settings/access-tokens |
| `ANDROID_KEYSTORE_BASE64` | `[Convert]::ToBase64String([IO.File]::ReadAllBytes("apps\mobile\credentials\android-upload.jks")) \| Set-Clipboard` |
| `ANDROID_KEYSTORE_PASSWORD` | `keystorePassword` in `apps/mobile/credentials.json` |
| `ANDROID_KEY_ALIAS` | `keyAlias` in `apps/mobile/credentials.json` |
| `ANDROID_KEY_PASSWORD` | `keyPassword` in `apps/mobile/credentials.json` |

### Cut a release
1. Bump `version` in `apps/mobile/app.config.ts` and add an entry at the top of
   `apps/web/lib/releases.ts` (this is what /updates shows).
2. Commit, then:
   ```powershell
   git tag v0.1.0
   git push origin main --tags
   ```
3. Watch Actions → *Release Android APK*. When green, the APK is at
   https://github.com/danrave1234/pay_record/releases/latest.

Keep the same keystore forever: Android only allows in-place updates when the
signing key matches. Back up `apps/mobile/credentials/android-upload.jks` and
`credentials.json` somewhere safe.

## 4. Website on Vercel

Project: **payrecord-web** (team `danrave1234s-projects`), GitHub repo
connected. Live at https://payrecord-web.vercel.app.

- Manual deploy anytime: `cd apps\web; vercel deploy --prod`.
- Git auto-deploys: in the Vercel dashboard → payrecord-web → Settings →
  General → **Root Directory = `apps/web`** (one-time; the CLI cannot set it).
  After that every push to `main` deploys production and PRs get previews.
- Optional env vars (Settings → Environment Variables):
  `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL`,
  `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_TESTFLIGHT_URL`,
  `NEXT_PUBLIC_ANDROID_APK_URL` (defaults to the latest GitHub release).
- Custom domain: Settings → Domains → add `payrecord.ph`, then set
  `NEXT_PUBLIC_SITE_URL=https://payrecord.ph`.

## 5. API for phones outside your Wi‑Fi

The NestJS API (`apps/api`) is a long-running Node process + worker, so it
does not fit Vercel functions. Deploy it to Railway / Render / Fly.io:
Dockerfile-less Node service, build `pnpm --filter @payrecord/api build`, start
`node apps/api/dist/main.js` (and a second service for `dist/worker.js`), with
the variables from `.env.example`. Then set `EXPO_PUBLIC_API_URL` in
`apps/mobile/eas.json` (`preview`/`production`) to that URL and rebuild.

## 6. iPhone

Requires a Mac with Xcode 16 or an EAS iOS build with an Apple Developer
account (`eas build --platform ios`). TestFlight link → set
`NEXT_PUBLIC_TESTFLIGHT_URL` on Vercel.
