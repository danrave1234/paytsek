# Google sign-in setup

The mobile app opens Google through the system browser and returns to the app
through `paytsek://auth/callback`.

1. In Google Cloud Console, create OAuth clients for Android package
   `ph.paytsek.app` (with the release signing SHA-1) and iOS bundle ID
   `ph.paytsek.app`.
2. In Supabase Dashboard → Authentication → Providers → Google, enable Google
   and paste the Google web OAuth client ID and secret.
3. In Supabase Dashboard → Authentication → URL Configuration, add
   `paytsek://auth/callback` to Additional Redirect URLs.
Never put the Google OAuth client secret in the mobile app or in an Expo public
environment variable. It belongs only in Supabase's Google provider settings.
