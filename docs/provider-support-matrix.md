# Provider support matrix

Source of truth: `packages/receipt-parsers/src/registry.ts` (`FLOW_REGISTRY`). The app reads `autoMatchFlows` per receiving source from the API, so this table and the UI can never disagree with the code.

## Receipt wallet classification

`OCR_LAYOUT_V1` identifies the wallet that issued the customer's proof. It combines exact brand wording, issuer phrases, OCR confidence, line position relative to amount/reference fields, and provider-specific receipt wording. Wallet names used only in destination context (for example, `To ... / GCash 09...`) are ignored. An imported screenshot filename can support another signal but is never sufficient by itself. If the best candidate does not clear both the minimum score and the runner-up margin, the receipt wallet stays unknown and the record is still saved.

This is separate from the receiving wallet. The receiving wallet comes from the allowlisted Android notification package and is attached through `source_id` only after notification evidence is selected. Classification describes the screenshot; it does not authenticate the screenshot or prove that money moved.

Provider detection evidence is stored as bounded method/confidence/candidate scores and privacy-safe signal codes alongside the OCR result. Add visual-model classification only after a versioned, consented, redacted evaluation set proves it improves held-out accuracy across provider versions, light/dark modes, direct screenshots, and photographed screens.

A flow is **(receipt provider, receiving provider, rail)**, and `autoMatchFlow()` resolves it using the rail from the *customer's confirmation* — a "money received" notification never says which rail was used. That is what stops an untested rail borrowing an enabled rail's rule.

**Collecting samples.** Unrecognised notifications are discarded by default. On the Android payment phone, Settings → Unknown formats turns on opt-in capture of *redacted shapes* (digits → `#`, letters → `a`/`A`) for `UNKNOWN_TEMPLATE` rejections only; OTP and security messages are never eligible. Export from that screen and paste into `tests/fixtures/`.

| Flow id | Receipt → Receiving | Rail | Recording | Auto-match | Evidence | Why / what is needed |
| --- | --- | --- | --- | --- | --- | --- |
| `gcash-to-gcash.express-send` | GCash → GCash | Express Send | ✔ | ✖ | REDACTED_REAL_SAMPLE | Current Android receiving pushes contain amount, masked sender and sender number, but not the receipt reference. Exact amount + nearby time is shown for Review. |
| `gcash-to-gcash.qr-p2p` | GCash → GCash | QR (personal) | ✔ | ✖ | REDACTED_REAL_SAMPLE | The payer screenshot contains a reference that the recipient push does not expose. Exact amount + nearby time is shown for Review. |
| `gcash-to-gcash.qr-merchant` | GCash → GCash | QR (merchant) | ✔ | ✖ | NONE | Merchant Scan-to-Pay confirmations use different channels per GCash help table; text unverified. |
| `gotyme-to-gcash.instapay-qr` | GoTyme → GCash | InstaPay/QR Ph | ✔ | ✖ | NONE | Cross-provider references are not the same identifier; no invented mapping. |
| `gotyme-to-gotyme.transfer` | GoTyme → GoTyme | Transfer | ✔ | ✖ | REDACTED_REAL_SAMPLE | Incoming template is recognised, but it has no comparable reference. Review required. |
| `maya-to-maya.qr-p2p` | Maya → Maya | QR (personal) | ✔ | ✖ | REDACTED_REAL_SAMPLE | Incoming InstaPay template is recognised, but it has no comparable reference. Review required. |
| `maya-to-maya.qr-merchant` | Maya → Maya | QR (merchant) | ✔ | ✖ | NONE | Merchant Scan-to-Pay confirmations use a different channel; text unverified. |
| `maya-to-gcash.instapay-qr` | Maya → GCash | InstaPay/QR Ph | ✔ | ✖ | NONE | Cross-provider references are not the same identifier; no invented mapping. |
| `gcash-to-maya.instapay-qr` | GCash → Maya | InstaPay/QR Ph | ✔ | ✖ | NONE | Cross-provider references are not the same identifier; no invented mapping. |
| `maribank-to-maribank.qr-p2p` | MariBank → MariBank | QR (personal) | ✔ | ✖ | REDACTED_REAL_SAMPLE | Incoming template is recognised, but it has no comparable reference. Review required. |

## Enabling a flow (checklist)

1. Collect redacted real samples (receipt screenshot text + notification title/text/bigText), record platform, wallet app version, and whether reference appears on both sides.
2. Add fixtures with `provenance: REDACTED_REAL_SAMPLE` to `tests/fixtures/…` and extend the TS adapter + Kotlin parser in lockstep; bump `parserVersion`.
3. Flip `autoMatchEnabled` / `referenceNamespacesComparable` in the registry and update `evidence` and `observedAppVersions`.
4. Run `pnpm test` and the Kotlin unit tests; run device rows 8–10 and 13–15 in `docs/testing.md`.
5. Update this file and `apps/web/lib/releases.ts` notes. The marketing table on the home page is derived from `FLOW_REGISTRY` via `apps/web/lib/providers.ts`, so it follows automatically on the next build.

## Supported wallets

GCash, GoTyme, Maya and MariBank. This is the whole list — no other wallet is recognised, and an unknown package is rejected before its text is inspected.

Every wallet has a registered notification adapter on both sides (`NOTIFICATION_ADAPTERS` in TypeScript, `TEMPLATED_PROVIDERS` in `NotificationParser.kt`). A wallet without a verified template is still registered and fails closed with `UNKNOWN_TEMPLATE` — never `UNKNOWN_PACKAGE` — because only the former is eligible for opt-in shape capture. A parity test in `parsers.test.ts` enforces this.

| Wallet | Recording | Notification parsing | Auto-match |
| --- | --- | --- | --- |
| GCash | ✔ | ✔ `gcash.incoming.v1` | ✖ (current receiving push has no comparable reference) |
| GoTyme | ✔ | ✔ `gotyme.incoming.v1` | ✖ (notification has no comparable reference) |
| Maya | ✔ | ✔ `maya.incoming.v1` | ✖ (notification has no comparable reference) |
| MariBank | ✔ | ✔ `maribank.incoming.v1` | ✖ (notification has no comparable reference) |

## Package allowlist & signing

| Provider | Package(s) | Signing pin |
| --- | --- | --- |
| GCASH | `com.globe.gcash.android` | none configured (recorded only) |
| GOTYME | `com.gotyme.gotymebank`, `ph.gotyme.app` | none configured |
| MAYA | `com.paymaya` | none configured — **package name not verified against a Play install yet** |
| MARIBANK | `ph.seabank.seabank` | none configured — **package name taken from the Play listing, not verified against an install** |

Add SHA-256 signer digests observed from a Play-installed copy to `ProviderApps.KNOWN_SIGNERS` before release to reject look-alike packages. Signature checks strengthen device provenance; they do not make the notification provider-signed evidence.
