# Signed evidence connectors and Philippine readiness

This document is an engineering control record, not a legal opinion or a claim of regulatory approval.

## Product boundary

PayTsek records a proof supplied by the user. Android wallet notifications and signed provider/PSP webhooks are supplementary evidence. They do not replace the proof, do not read a wallet balance, do not move money, and do not create a user-facing status beyond **Recorded**, **Possible match**, **Strong match**, **Owner confirmed**, or **Voided**.

The generic signed-webhook endpoint is infrastructure for a future contracted provider adapter. It must not be enabled for production merely because the API exists. Before enabling an adapter, obtain a written provider agreement, document its event semantics and reversal behavior, complete the privacy and BSP boundary reviews below, and run the release tests.

## Official API landscape (reviewed 2026-10-01)

The useful distinction is not “has an API” but “can an authorized PayTsek merchant receive reliable status for the same payment being recorded?” The current official material supports this assessment:

| Provider | Officially documented access | Fit for PayTsek's current proof recorder |
| --- | --- | --- |
| GoTyme Bank | No self-service transaction-feed or merchant-payment developer API was found on GoTyme's public site. Its published business material invites commercial partnerships for specific products. | Do not build against private app endpoints or scrape the app. Keep Android evidence and pursue a written partnership or consented Open Finance route. |
| GCash | GCash has an API Portal, but states that it is available only to selected partner organizations through account-manager onboarding. GCash for Business separately offers merchant payment products and a transaction portal. | Technically promising only after partner approval. It is not a public consumer-wallet feed and must not be presented as generally available. |
| Maya | Maya publishes payment APIs, retrieval endpoints, sandbox guidance, and retrying webhooks. Production use requires merchant/partner onboarding and solution-specific keys. | Best documented direct adapter candidate for transactions created through a Maya merchant product. It does not expose arbitrary incoming personal-wallet transfers. A move into payment acceptance triggers the BSP gate below. |
| UnionBank | The developer portal publishes sandbox APIs including consented customer transaction history; UAT/production require partner onboarding. | A possible future consented bank/Open Finance adapter, not a substitute for GoTyme/GCash/Maya wallet feeds and outside the current supported-wallet scope. |

Official references: [GoTyme business partnerships](https://www.gotyme.com.ph/business/merchant-cash-advance), [GCash API Portal FAQ](https://gcash.com/business/api-portal-faqs), [GCash for Business](https://gcash.com/business/msme), [Maya webhook guidance](https://developers.maya.ph/reference/configuring-your-webhook-for-maya-checkout), [Maya Checkout onboarding](https://developers.maya.ph/reference/accept-one-time-payment-using-maya-checkout), and [UnionBank developer portal](https://developer.unionbankph.com/reference).

Conclusion: APIs can materially improve reliability, but none is a drop-in replacement for notifications across the four supported wallets. Implement provider-specific adapters only behind the generic signed-event boundary, and keep proof capture fully usable without them.

## Connector security contract

- An owner creates a connector for one existing workspace receiving source. The source is resolved on the server; a webhook cannot choose a workspace, source, or wallet provider.
- The server returns a per-connector signing secret only when the connector is created or rotated. Only its version and a master-key derivation input are retained.
- Requests use `paytsek-signature: t=<unix-seconds>,v1=<hex-hmac-sha256>` over `<timestamp>.<exact raw body>`.
- Signatures outside the five-minute window fail. Event IDs and payment IDs are independently deduplicated.
- Payloads accept only payment/delivery IDs, status, PHP amount, occurrence time, rail, and an optional bounded reference. Payer names, phone numbers, raw messages, credentials, account numbers, and balances are rejected by the strict contract.
- Raw webhook bodies are validated in memory and are not persisted or logged. Only a SHA-256 payload digest is retained for replay/integrity diagnosis.
- `REVERSED` and `REFUNDED` are terminal. They deactivate an active evidence link and move an affected record to **Possible match** without deleting the proof or audit history.

## Philippine privacy controls

The Data Privacy Act and its IRR require transparency, legitimate purpose, proportionality, and reasonable organizational, physical, and technical safeguards. PayTsek's relevant controls are:

| Principle / obligation | PayTsek control | Release evidence |
| --- | --- | --- |
| Transparency and purpose | Privacy screen and notice explain proof, notification, auto-capture, and connector processing | Copy review and production Privacy Notice |
| Proportionality | Strict webhook schema; rejected auto-capture frames deleted locally; raw notification/webhook text excluded from logs and analytics | Contract tests and device storage inspection |
| Security | Private proof bucket, short-lived signed URLs, tenant authorization, HMAC webhooks, replay window, idempotency, audit trail | API tests, DB scope tests, key-rotation exercise |
| Data-subject rights | Authenticated privacy export and account/workspace deletion flows | Access/export/deletion runbook exercise |
| Retention | Unlinked evidence 7 days; beta proofs 30 days; records/history 12-month eligibility dry-run (no automatic purge); exports 24 hours | Purge job test and deletion verification |
| Breach management | Maintain an incident register and assess notification to NPC/data subjects within 72 hours where the legal test is met | Tabletop exercise and named incident owner |

Primary references: [Data Privacy Act of 2012](https://privacy.gov.ph/data-privacy-act/), [Implementing Rules and Regulations](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/), [NPC data-subject rights](https://privacy.gov.ph/data-subject-rights/), and [NPC breach reporting](https://privacy.gov.ph/pips-and-pics/breach-reporting/).

## NPC registration analysis gate

The operator confirmed no registered operating business on 2026-10-04. Identity,
privacy responsibility and applicability remain unresolved. See the maintained
[privacy operations and launch-gate register](privacy-operations.md).

NPC Circular No. 2022-04 requires registration when any mandatory criterion applies, including processing sensitive personal information of at least 1,000 individuals or processing likely to pose a risk to data-subject rights and freedoms. Otherwise, voluntary registration or the prescribed sworn declaration may apply. PayTsek processes financial/transaction evidence, so the organization must document its threshold and risk analysis with its DPO or Philippine privacy counsel before public-beta scale; do not assume a small headcount creates an exemption. Covered new systems/DPO appointments have a 20-day registration rule. See the [NPC registration FAQ](https://privacy.gov.ph/pips-and-pics/faqs/) and [Circular No. 2022-04](https://privacy.gov.ph/wp-content/uploads/2023/05/Circular-2022-04-1.pdf).

## BSP boundary gate

The current connector observes structured evidence from an already-contracted provider and does not initiate, acquire, settle, or route payments. Any future feature that generates payment credentials/QRs, accepts or processes payments for merchants, controls settlement, or markets PayTsek as a payment acceptance provider must stop for a formal BSP self-assessment and Philippine counsel review before implementation or launch.

BSP Circular No. 1049 covers operators that maintain or operate systems enabling payments/fund transfers or process payments on behalf of others. BSP Circular No. 1198 governs merchant payment acceptance activities and requires a merchant acquisition license for merchant acquisition. Prefer integration under a BSP-supervised/licensed PSP contract rather than silently expanding PayTsek's role. See [Circular No. 1049](https://www.bsp.gov.ph/Regulations/Issuances/2019/c1049.pdf), [Circular No. 1198](https://www.bsp.gov.ph/Regulations/Published%20Issuances/Images/Circular_1198.pdf), and the [BSP MPAA FAQ](https://www.bsp.gov.ph/Regulations/Issuances/2024/1198%20-%20FAQ.pdf).

Open Finance access must remain explicit and consent-driven. PayTsek must never collect online-banking credentials or use screen scraping as a substitute for a qualified provider integration. See [BSP Circular No. 1122](https://www.bsp.gov.ph/Regulations/Issuances/2021/1122.pdf).

## Subprocessors and contractual checks

Keep the production subprocessor register current for Supabase (Auth/Postgres/private storage), Vercel (API/web hosting), GitHub (APK release distribution), optional Sentry, and each enabled evidence provider. For each, record purpose, data categories, processing location, retention/deletion terms, security commitments, breach notification terms, and data-processing agreement status. Do not send proof images or raw notification text to error monitoring.

## Production enablement checklist

1. Complete and approve the privacy impact assessment for the specific connector/provider.
2. Confirm the merchant owns or is authorized to connect the receiving account/source.
3. Complete NPC DPO/DPS registration or sworn-declaration analysis.
4. Complete the BSP OPS/MPAA boundary assessment; obtain any required license or use a properly licensed contracted provider.
5. Add provider-specific signature, event, reversal, retry, and sandbox fixtures. The generic adapter is not evidence that a provider is supported.
6. Store the master signing key only in the API secret manager; exercise connector secret rotation and revocation.
7. Run the automated, database, and real-device rows in `docs/testing.md`, including zero false automatic matches.
8. Update the Privacy Notice, subprocessor list, retention schedule, support/recourse process, and 72-hour breach-assessment contacts before launch.
