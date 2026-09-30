# Provider support matrix

Sources of truth are deliberately split:

- `packages/receipt-parsers/src/registry.ts` (`FLOW_REGISTRY`) controls the stricter exact-reference path.
- `apps/api/src/matching/matcher.ts` controls unique amount-and-time matching. One recognized, unclaimed notification with the exact amount inside the safe time window can become a Strong match; multiple or conflicting candidates become Possible match.

Both paths are server-authoritative. The scanner never selects or elevates a notification on its own.

Signed webhook connectors use the same matcher and labels. The generic HMAC adapter is infrastructure, not a claim that a wallet or bank is supported. A provider becomes supported only after a contract, provider-specific adapter/fixtures, privacy review, BSP boundary review, and sandbox/device verification described in `docs/evidence-connectors-and-ph-readiness.md`.

## Receipt wallet classification

`OCR_LAYOUT_V1` identifies the wallet that issued the customer's proof. It combines exact brand wording, issuer phrases, OCR confidence, line position relative to amount/reference fields, and provider-specific receipt wording. Wallet names used only in destination context (for example, `To ... / GCash 09...`) are ignored. An imported screenshot filename can support another signal but is never sufficient by itself. If the best candidate does not clear both the minimum score and the runner-up margin, the receipt wallet stays unknown and the record is still saved.

This is separate from the receiving wallet. The receiving wallet comes from the allowlisted Android notification package and is attached through `source_id` only after notification evidence is selected. Classification describes the screenshot; it does not authenticate the screenshot or prove that money moved.

Provider detection evidence is stored as bounded method/confidence/candidate scores and privacy-safe signal codes alongside the OCR result. Add visual-model classification only after a versioned, consented, redacted evaluation set proves it improves held-out accuracy across provider versions, light/dark modes, direct screenshots, and photographed screens.

A flow is **(receipt provider, receiving provider, rail)**, and `autoMatchFlow()` resolves the exact-reference path using the rail from the *customer's confirmation* — a "money received" notification never says which rail was used. This registry does not disable the separate unique amount-and-time policy.

**Collecting samples.** Unrecognised notifications are discarded by default. On the Android payment phone, Settings → Unknown formats turns on opt-in capture of *redacted shapes* (digits → `#`, letters → `a`/`A`) for `UNKNOWN_TEMPLATE` rejections only; OTP and security messages are never eligible. Export from that screen and paste into `tests/fixtures/`.

| Flow id | Receipt → Receiving | Rail | Recording | Exact-reference auto | Unique amount/time auto | Evidence | Why / what is needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `gcash-to-gcash.express-send` | GCash → GCash | Express Send | ✔ | ✖ | ✔ when recognized | REDACTED_REAL_SAMPLE | Current Android pushes contain amount and masked sender details, but not the receipt reference. |
| `gcash-to-gcash.qr-p2p` | GCash → GCash | QR (personal) | ✔ | ✖ | ✔ when recognized | REDACTED_REAL_SAMPLE | The payer screenshot reference is absent from the current recipient push. |
| `gcash-to-gcash.qr-merchant` | GCash → GCash | QR (merchant) | ✔ | ✖ | ✔ when recognized | NONE | Merchant Scan-to-Pay notification text is not verified yet. |
| `gotyme-to-gcash.instapay-qr` | GoTyme → GCash | InstaPay/QR Ph | ✔ | ✖ | ✔ when recognized | NONE | Cross-provider references are not treated as the same identifier. |
| `gotyme-to-gotyme.transfer` | GoTyme → GoTyme | Transfer | ✔ | ✖ | ✔ when recognized | REDACTED_REAL_SAMPLE | The incoming template has no comparable reference. |
| `maya-to-maya.qr-p2p` | Maya → Maya | QR (personal) | ✔ | ✖ | ✔ when recognized | REDACTED_REAL_SAMPLE | The incoming template has no comparable reference. |
| `maya-to-maya.qr-merchant` | Maya → Maya | QR (merchant) | ✔ | ✖ | ✔ when recognized | NONE | Merchant Scan-to-Pay notification text is not verified yet. |
| `maya-to-gcash.instapay-qr` | Maya → GCash | InstaPay/QR Ph | ✔ | ✖ | ✔ when recognized | NONE | Cross-provider references are not treated as the same identifier. |
| `gcash-to-maya.instapay-qr` | GCash → Maya | InstaPay/QR Ph | ✔ | ✖ | ✔ when recognized | NONE | Cross-provider references are not treated as the same identifier. |
| `maribank-to-maribank.qr-p2p` | MariBank → MariBank | QR (personal) | ✔ | ✖ | ✔ when recognized | REDACTED_REAL_SAMPLE | The incoming template has no comparable reference. |

## Enabling a flow (checklist)

1. Collect redacted real samples (receipt screenshot text + notification title/text/bigText), record platform, wallet app version, and whether reference appears on both sides.
2. Add fixtures with `provenance: REDACTED_REAL_SAMPLE` to `tests/fixtures/…` and extend the TS adapter + Kotlin parser in lockstep; bump `parserVersion`.
3. Flip `autoMatchEnabled` / `referenceNamespacesComparable` in the registry and update `evidence` and `observedAppVersions`.
4. Run `pnpm test` and the Kotlin unit tests; run device rows 8–10 and 13–15 in `docs/testing.md`.
5. Update this file and `apps/web/lib/releases.ts` notes. The website derives supported receiving wallets from the allowlisted Android packages and describes exact-reference support separately.

## Supported wallets

GCash, GoTyme, Maya and MariBank. This is the whole list — no other wallet is recognised, and an unknown package is rejected before its text is inspected.

Every wallet has a registered notification adapter on both sides (`NOTIFICATION_ADAPTERS` in TypeScript, `TEMPLATED_PROVIDERS` in `NotificationParser.kt`). A wallet without a verified template is still registered and fails closed with `UNKNOWN_TEMPLATE` — never `UNKNOWN_PACKAGE` — because only the former is eligible for opt-in shape capture. A parity test in `parsers.test.ts` enforces this.

| Wallet | Recording | Notification parsing | Unique amount/time auto | Exact-reference auto |
| --- | --- | --- | --- | --- |
| GCash | ✔ | ✔ `gcash.incoming.v1` | ✔ when it is the sole safe candidate | ✖ (current receiving push has no comparable reference) |
| GoTyme | ✔ | ✔ `gotyme.incoming.v1` | ✔ when it is the sole safe candidate | ✖ (notification has no comparable reference) |
| Maya | ✔ | ✔ `maya.incoming.v1` | ✔ when it is the sole safe candidate | ✖ (notification has no comparable reference) |
| MariBank | ✔ | ✔ `maribank.incoming.v1` | ✔ when it is the sole safe candidate | ✖ (notification has no comparable reference) |

## Package allowlist & signing

| Provider | Package(s) | Signing pin |
| --- | --- | --- |
| GCASH | `com.globe.gcash.android` | none configured |
| GOTYME | `com.gotyme.gotymebank`, `ph.gotyme.app` | none configured |
| MAYA | `com.paymaya` | none configured — **package name not verified against a Play install yet** |
| MARIBANK | `ph.seabank.seabank` | none configured — **package name taken from the Play listing, not verified against an install** |

Add SHA-256 signer digests observed from a Play-installed copy to `ProviderApps.KNOWN_SIGNERS` before release to reject look-alike packages. Signature checks strengthen device provenance; they do not make the notification provider-signed evidence.
