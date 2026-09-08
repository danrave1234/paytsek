# Provider support matrix

Source of truth: `packages/receipt-parsers/src/registry.ts` (`FLOW_REGISTRY`). The app reads `autoMatchFlows` per receiving source from the API, so this table and the UI can never disagree with the code.

| Flow id | Receipt → Receiving | Rail | Recording | Auto-match | Evidence | Why / what is needed |
| --- | --- | --- | --- | --- | --- | --- |
| `gcash-to-gcash.express-send` | GCash → GCash | Express Send | ✔ | ✔ **only when the notification contains the Ref No.** | SYNTHETIC | Based on the user-observed sample (amount, masked sender, masked phone). Whether GCash includes the reference in the notification is not proven; when absent the record goes to Review. Need: 3+ redacted real notification+receipt pairs, app version noted. |
| `gcash-to-gcash.qr-p2p` | GCash → GCash | QR (personal) | ✔ | ✖ | NONE | No real QR-to-personal notification sample captured. |
| `gcash-to-gcash.qr-merchant` | GCash → GCash | QR (merchant) | ✔ | ✖ | NONE | Merchant Scan-to-Pay confirmations use different channels per GCash help table; text unverified. |
| `gotyme-to-gcash.instapay-qr` | GoTyme → GCash | InstaPay/QR Ph | ✔ | ✖ | NONE | Cross-provider references are not the same identifier; no invented mapping. |
| `gotyme-to-gotyme.transfer` | GoTyme → GoTyme | Transfer | ✔ | ✖ | NONE | GoTyme notification adapter fails closed (`gotyme.incoming.unsupported`). |

## Enabling a flow (checklist)

1. Collect redacted real samples (receipt screenshot text + notification title/text/bigText), record platform, wallet app version, and whether reference appears on both sides.
2. Add fixtures with `provenance: REDACTED_REAL_SAMPLE` to `tests/fixtures/…` and extend the TS adapter + Kotlin parser in lockstep; bump `parserVersion`.
3. Flip `autoMatchEnabled` / `referenceNamespacesComparable` in the registry and update `evidence` and `observedAppVersions`.
4. Run `pnpm test` and the Kotlin unit tests; run device rows 8–10 and 13–15 in `docs/testing.md`.
5. Update this file and `apps/web/lib/releases.ts` notes.

## Package allowlist & signing

| Provider | Package(s) | Signing pin |
| --- | --- | --- |
| GCASH | `com.globe.gcash.android` | none configured (recorded only) |
| GOTYME | `com.gotyme.gotymebank`, `ph.gotyme.app` | none configured |

Add SHA-256 signer digests observed from a Play-installed copy to `ProviderApps.KNOWN_SIGNERS` before release to reject look-alike packages. Signature checks strengthen device provenance; they do not make the notification provider-signed evidence.
