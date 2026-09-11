# Phone onboarding

The first-run guide is scoped to signed-in user, workspace, and installation. Completing scanner registration or choosing Finish later remembers that the guide was seen. More → Phone setup always reopens it. This flag does not assert that accounts or notification access are configured.

## Owner

1. Add each wallet notification source used on the main payment phone.
2. Open main-phone setup, select the wallet source, and choose this Android phone or create a code for another Android phone.
3. On the main phone, review the explanation and accept pairing. For same-phone setup, the signed-in owner authorizes approval through the owner-only API; another phone still requires the owner to approve separately.
4. Accept sharing and grant Android notification access. Inspect listener health afterward.
5. Invite employees from Team. Each employee signs in, accepts the invite, and registers their scanner from onboarding.

Scanner registration uses POST /v1/devices/register-scanner with the install ID and phone label. It does not configure the notification collector or copy wallet credentials. Server plan limits remain authoritative.

The pairing screen can be opened from sign-in without a user session. All other workspace routes retain the existing authentication gate.

## Current limits

- The native collector currently stores one wallet-source binding per installation. Pairing is not blanket support for every wallet installed on the phone.
- Current flow registry enables specific GCash flows. Maya, GoTyme, and MariBank automatic matching remain disabled; recording and manual confirmation are available.
- Main-phone notification collection requires Android; employee scanning supports Android and iOS.

## Verification

- Mobile typecheck passed.
- Inspected API route, request shape, label limit, and owner-only approval guard against server code.
- Android first-run guide and Finish later → Scan navigation rendered successfully.
- Evidence: .artifacts/ui-audit/43-phone-onboarding.png, 44-onboarding-actions.png, 46-raised-scan-settled.png.
- Live two-phone pairing, employee invitation acceptance, notification access, and actual wallet notifications were not exercised in this pass.
