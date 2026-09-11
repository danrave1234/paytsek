# PayTsek — Full MVP implementation brief

Prepared for Drave's AI coding agent · 8 September 2026

Working name only; no trademark or domain availability is implied.

## 1. Mission and delivery contract

Build a complete, usable Android and iOS mobile MVP for Philippine sellers who scan a customer's payment receipt and reconcile that record with incoming-payment notifications captured on the seller's own Android phone. The scanning and receiving phones may be different devices, in different places, and on different networks.

Do not substitute a notification debugger, proof of concept, landing page, or mocked dashboard for the requested MVP. Deliver the application, native modules, API, database migrations, secure pairing, matching and review flows, offline queues, billing, exports, tests, and deployment instructions. Implement in dependency order, but all phases below are part of the same MVP.

Do not build a POS, inventory suite, invoice generator, payment gateway, escrow, wallet, or freelancer marketplace. Customers continue paying the seller's existing QR/account. The application never transfers their purchase money and never requests wallet credentials, MPINs, OTPs, or bank login details.

The principal promise is: "Scan a payment proof, keep an organized record, and match it with incoming-payment evidence from your receiving phone."

Do not promise fraud prevention, guaranteed notification delivery, live wallet balance, bank verification, or legal compliance merely because a payment was matched.

## 2. Confirmed capabilities and unresolved dependencies

Android provides NotificationListenerService for user-authorized access to posted notifications and their originating package. This does not expose a wallet's private in-app inbox or transaction history. [R1]

Apple's ordinary UserNotifications API manages the application's own notifications. Do not implement or advertise an iOS listener for another application's notifications. iOS participates as a scanner, reviewer, and dashboard client connected to an Android collector. No private APIs or jailbreak workarounds. [R2]

GCash documents Express Send notifications for both parties and different confirmation channels for consumer and merchant Scan to Pay. Its published channel table does not establish the exact text available to Android's listener or guarantee shared reference numbers. Treat the user's observed amount/masked sender/phone format as a sample to support, not a universal provider contract. [R3]

The Android collector must be the phone on which the receiving GCash account actually receives notifications. Pairing another Android device does not forward GCash notifications from an iPhone. A second phone cannot obtain notifications from the owner's account just because it is paired with this application.

Receipt recording supports GCash and GoTyme as launch targets. Automatic notification reconciliation is enabled per tested payment flow, not merely per brand. Create provider adapters and a capability registry. If real GoTyme or merchant-QR notification payloads are unavailable, retain recording/manual confirmation and visibly disable automatic matching for that flow. Do not fabricate payload formats or claim support from a stub parser.

## 3. Platform and device roles

| Capability | Android | iOS |
| --- | --- | --- |
| Camera receipt capture and local OCR | Yes | Yes |
| Import a saved receipt image | Yes | Yes |
| Receive an image via the OS share sheet | Yes | Yes, through a share extension |
| Ledger, review, exports, owner dashboard | Yes | Yes |
| Live status from the backend | Yes | Yes |
| Capture supported wallet notifications | Yes, with explicit access | No |
| Work with a remote Android receiving phone | Yes | Yes |

A device has capabilities SCANNER, COLLECTOR, or BOTH. These are separate from human permissions.

Human roles:

- Owner: membership, sources, pairing, billing, all permitted records, review, manual confirmations, corrections, exports, and deletion controls.
- Cashier: create records, see authorized store records, inspect restricted candidate matches, and confirm a proposed match when the owner permits it. Cannot pair collectors, change receiving accounts, override conflicts, or grant entitlements.

Use one business workspace per subscription in the MVP. Users can belong to several workspaces, but every action explicitly selects one. A workspace has its own members, quotas, sources, records, storage, and audit trail.

## 4. Required end-to-end flows

### 4.1 Owner onboarding

Create an account using Supabase Auth email/password with verification and recovery. Create a workspace, set timezone to Asia/Manila by default, and enter a display name. No SMS OTP subscription dependency is required for this app's authentication.

Add a receiving source: receiving provider, account label, owner-declared identifier, masked display value, and permitted receipt recipient aliases. Clearly label account association as owner-configured, not provider-verified.

Choose same-device or separate-device operation. On an iPhone, offer only "Connect Android payment phone" or "Use recording/manual confirmation."

Explain notification access and business-data sharing before opening Android settings. Show the selected wallet applications and allow collection to be paused or revoked. A scanner-only phone never requests notification access.

### 4.2 Secure remote pairing

An authenticated owner creates a single-use, short-lived pairing QR/code. The collector displays the workspace, source, and requested capability before acceptance. Finish with owner approval of the new device. Pairing is possible remotely using the short code; it does not require Bluetooth, LAN discovery, or physical proximity.

Use a cryptographically random token, store only its hash, expire it after five minutes, rate-limit attempts, and consume it atomically. Do not put login tokens or durable credentials in the QR.

Issue a collector-scoped credential limited to event ingestion and health reporting for explicitly bound sources. Store credentials using Android Keystore-backed protection. Support rotation, immediate server-side revocation, and reassignment through a fresh pairing operation.

One active collector per receiving account/provider binding in the MVP prevents uncontrolled double ingestion. Multiple different receiving accounts use distinct bindings. A single Android phone may collect different supported providers, but do not assume multiple logins of the same wallet package can be distinguished.

Re-pair when the owner changes the receiving wallet account. Detect and pause on known account-identity conflicts; disclose that account changes may not always be detectable from notifications.

### 4.3 Scan and record

Cashier selects the receiving source or uses an owner-configured default, captures the customer's receipt, and reviews extracted fields. Offer image import and share-sheet import as equivalent inputs.

Run local OCR. Crop and rotate without destroying the retained evidence image; show low-readability warnings and manual correction. Extract only fields actually visible. Missing values remain null. Never invent a sender name, reference number, date, or status.

Maintain separate payer and payee fields. A sender's successful-payment receipt commonly identifies the recipient; this must not be compared to the sender identity in an incoming notification.

Required record fields: workspace, source, currency, amount in integer centavos, capture/import origin, staff member, capture time, and server creation time. Optional fields: receipt provider, payment rail, reference namespace/value, payer/payee name or phone, receipt transaction time with precision, receipt status, customer label, and note/order label.

Store the original OCR result separately from user corrections. Mark edited matching-critical fields. Save a durable local draft before initiating uploads. The server records UNVERIFIED unless an independently qualifying match already exists.

### 4.4 Notification before or after the scan

Either input can arrive first. Persist unmatched incoming events, then rerun reconciliation when an event, proof, or authorized correction arrives. A backend retry worker handles failures. On app resume/reconnect, refetch server state; realtime updates and push notifications are not the system of record.

### 4.5 Review and manual confirmation

Display proposed matches with their actual supporting and missing fields. Cashiers must not see the owner's complete personal notification inbox. Return only scoped, short-window candidates with masked identifiers and minimal fields.

An authorized user can confirm a proposed association. An owner can separately confirm receipt of funds after checking the wallet directly. These actions have different audit labels from automatic matches.

Do not mark a payment as failed or fraudulent just because a notification has not arrived. Show "No matching notification yet" and collector connectivity information.

## 5. User-visible evidence and states

Use these states consistently in screens, exports, API responses, and analytics:

| State | Meaning |
| --- | --- |
| UNVERIFIED | Proof recorded; no accepted recipient-side association |
| REVIEW_REQUIRED | Candidate evidence, uncertainty, or a conflict requires a person |
| MATCHED_AUTO | Matching rule found the required independent identifiers |
| MATCHED_BY_USER | Authorized user selected a notification association |
| CONFIRMED_MANUALLY | Owner reports checking receipt directly in the wallet |
| VOIDED | Record excluded from totals with a retained reason/audit event |

Treat DUPLICATE_SUSPECTED, RECIPIENT_MISMATCH, SOURCE_STALE, PARSE_UNSUPPORTED, and SIMILAR_IMAGE as flags, not necessarily mutually exclusive states.

Default UI labels: "Unverified", "Review needed", "Notification matched", and "Confirmed manually". An automatic match detail must state "Matched to an incoming notification; not confirmed directly with the payment provider."

Do not use "GCash verified", an unconditional green VERIFIED label, or fictional percentages such as "98% certain". A future PROVIDER_VERIFIED state must remain unavailable until a real authenticated provider integration exists.

## 6. Matching policy — correctness before automatic coverage

### 6.1 Mandatory boundaries

Every match is within the same workspace and intended receiving account. The backend derives collector/source identity from the authenticated pairing, not from a caller-supplied workspace/source field.

Compare exact currency and amount received. Separate transfer principal from fees and displayed total charge. Do not guess fee deductions.

Reject outgoing transfers, promotions, authentication messages, failed/pending messages, and unsupported notification formats as confirmation evidence. An ordinary positive incoming-payment phrase is required by the relevant adapter.

Keep receipt provider, receiving provider, payment rail, reference namespace, and reference value separate. A GoTyme-to-GCash QR transfer may not expose the same reference on both sides. Never assume all QR payments or all references are interchangeable.

### 6.2 Automatic match rule

Default automatic matching requires an exact, independently obtained reference or equivalent stable transaction identifier in a namespace proven comparable for that flow, the exact receiving amount/currency, the intended receiving source, and no contradictory data.

A reference printed only on the buyer's receipt is useful for duplicate detection but cannot be matched against a notification that does not contain that identifier.

Amount plus timestamp alone, even with just one current candidate, never causes automatic confirmation. Masked names or a partial phone number are supporting clues, not unique identifiers. Do not compare a receipt's recipient to a notification's sender.

If future real data validates another safe rule using independent, comparable identifying fields, version and test that rule explicitly. Do not silently widen the default policy to boost match rate.

### 6.3 Suggested matches

Search unmatched incoming events for the selected receiving source and exact amount/currency within a configurable candidate window. Suggested initial window: five minutes around a trustworthy receipt transaction time; use capture time only as a weaker fallback. Record which time basis and precision were used.

Missing dates, delayed uploads, phone clock drift, masked-only identity, manual field edits, and unproven cross-provider reference mapping lead to review. Expanding a time window may produce suggestions but must not relax automatic-match requirements.

A delayed exact-ID match may be valid after the short suggestion window, subject to no contradictions. Explain the delay in the audit record.

### 6.4 One-to-one consumption and races

One canonical incoming payment event can be linked to at most one active payment record, and one payment record has at most one active event association in the MVP. Do not implement split payments, one-to-many allocations, or partial payment accounting in this release.

Enforce this with database partial unique constraints and a transaction that locks/rechecks both sides. Do not rely on JavaScript filtering or a UI lock.

Two employee phones racing to claim one incoming event must produce one winner; the other receives a conflict and refreshed review state. Never confirm both.

Corrections or unlinking cannot silently erase history. Material edits reopen reconciliation. Owner-only unlink/reassign records reason, previous association, and new association. Repeated suspicious changes are visible in audit history.

### 6.5 Duplicates

Use scoped normalized references when present, upload idempotency keys, exact evidence-image hashes, and notification lifecycle deduplication. A perceptual image hash is only a similarity warning; two photos of the same screen have different bytes, and similar layouts do not imply the same transfer.

A duplicate submission does not create another counted payment or consume another quota unit. Attach additional evidence to the existing record where authorized. If the first OCR reference was wrong, an owner can correct it with an audit trail.

Never maintain a shared cross-business blacklist of customers or references.

## 7. Android native collector

Implement as a Kotlin Expo local module with a real NotificationListenerService. Do not make background ingestion depend on React Native JavaScript being awake. Android's callback contains the source package and notification object. [R1]

Declare the service correctly and use the documented notification-access settings flow. Independently identify the installed supported provider package from authoritative app metadata; do not trust the notification title or app display name. Validate known signing identity/rotation where feasible and record the actual package/app version. These checks strengthen device-side provenance but do not create a provider-signed server record.

Inspect appropriate text extras, including title, text, expanded text and supported multiline/message styles. Ignore group summaries unless a tested parser can separate actual individual events. Posting the same notification again or updating its text must not create a new incoming payment automatically.

Pipeline:

1. Check enabled source bindings and allowlisted origin before reading/storing payload text.
2. Parse only positive incoming-payment templates on-device.
3. Drop OTPs, security/login prompts, outgoing payments, promotions, unrelated apps, and unknown content. Never upload these to diagnostics.
4. Persist a canonical local event and outbox item before the callback work is acknowledged by the application.
5. Attempt prompt lifecycle-safe upload; use WorkManager retries with backoff and network constraints for reliable retry. Expedited work has quotas and is not a guarantee of instant execution. [R6]
6. Mark acknowledged items and clean up according to retention policy.

Use a native Room/SQLite store, keeping sensitive payload columns encrypted with a vetted platform-backed encryption implementation. Do not store unencrypted raw notification bodies in logs or general React Native AsyncStorage.

Store separate timestamps: provider-described time if present, Notification.when, posted time, device-capture wall clock, monotonic capture time plus boot/session identifier, and server-received time. Never label post time as provider settlement time.

After reconnection to the system listener, enumerate active notifications only as a deduplicated recovery attempt. This is not historical access and cannot recover notifications that were never posted or are already gone.

Unknown templates should increment a content-free diagnostic metric. A separately consented diagnostic export may include user-reviewed, redacted payment samples. It is not enabled by default.

Notification capture can be interrupted by settings, force-stop, OS restrictions, wallet behavior, or device state. Android also restricts sensitive notification content, including OTP-containing notifications. Do not defeat these controls or request users to disable security protections. [R7]

Use current permitted background APIs. Do not disguise indefinite background execution as another foreground-service type or promise uninterrupted operation.

## 8. Personal phone privacy and health

The receiving phone may be the owner's personal phone. A wallet notification does not inherently say whether money is business or personal. Onboarding must explain this clearly.

Default sharing: owner can inspect the incoming-payment inbox; employees see only restricted candidate evidence related to their authorized scans and resulting matched records. Offer pause/resume and an option requiring owner approval before an event is associated with a staff-created record.

Do not upload all device notifications. Do not read SMS through Messages notifications as a hidden workaround. SMS import/listening is outside the initial supported confirmation path; any later SMS implementation needs its own threat model, permissions/policy review, and weaker provenance label.

Health screen fields: source label, collector name, last server contact, last locally observed event, pending upload count, listener connected/disconnected, access granted/revoked, app version, and diagnostic reason when known.

Use "Last seen 3 minutes ago" instead of a misleading permanent green "online" badge. Server silence does not prove the device is powered off, and a recent heartbeat does not prove GCash will emit every notification.

If collection stops, warn scanners without treating unverified payments as unpaid. Connectivity status does not change evidence validity by itself.

## 9. Mobile screens and interaction requirements

Five primary areas: Home, Scan, Records, Review, and Settings. Show owner-only management inside Settings rather than an enterprise navigation system.

Home: separately show notification-matched records, manual confirmations, unverified records, review count, and collector health. These are recorded-payment totals, not actual wallet balance or guaranteed sales revenue.

Scan: prominent capture action, source selector, crop/retry, detected amount/reference, low-readability indicators, optional customer/order note, and Save. Distinct feedback for "saved" versus "notification matched". Never play a success sound implying payment verification just because OCR succeeded.

Records: search reference/customer/note, filter status/source/date/staff, paginate, and display capture/sync/evidence state. Viewing a record shows receipt, field provenance, matching explanation, edits, and authorized actions.

Review: explain candidate count, show known/missing identifying information, allow authorized confirmation, and permit escalation to the owner. An unmatched receipt remains searchable.

Settings: team invites/removal, sources, device pairing/revocation, privacy/retention, usage/billing/restore purchases, account/workspace deletion, support, and collection diagnostics.

Implement real loading, denied-permission, offline, empty, revoked-device, quota-exhausted, partial-upload, unsupported-format, and backend-error states. Use readable type, large touch targets, light/dark support, and status text/icons in addition to color.

## 10. Technical architecture

Use this default stack unless a supplied existing repository requires preservation of a compatible choice:

- Mobile: React Native + TypeScript + Expo development builds, Expo Router, and Expo config plugins/local modules. Do not use Expo Go for native collector testing. Expo supports custom native code through development builds. [R4]
- OCR: on-device ML Kit Text Recognition for Android and iOS through one thin local native module; bundle the required model where supported for predictable first-use behavior. No LLM or paid cloud OCR dependency for normal scans. ML Kit supports both platforms and local processing. [R5]
- Capture/import: Expo Camera and system photo picker, with Android intent handling and a real iOS image share extension writing to an App Group staging container.
- Scanner offline state: SQLite plus protected app-private media. Keep the Android collector outbox native and accessible while JS is stopped.
- UI state/forms: TanStack Query and React Hook Form with Zod validation; do not duplicate server business state in several stores.
- API: one NestJS TypeScript application. Parameterized Postgres queries through a small repository layer. Supabase Auth for user identity and secure private Storage for images/exports.
- Database: Supabase Postgres, reviewed SQL migrations, row-level security for any client-readable tables, and transactional server write paths for billing/matching.
- Live updates: Supabase Realtime for narrowly scoped authorized change notifications; refetch API state on reconnect. No second custom socket system.
- Jobs: a small Postgres-backed jobs/outbox table and a NestJS worker with leases, retries and SKIP LOCKED. No Redis or microservices required for this MVP.
- Billing: RevenueCat React Native SDK wrapping Apple/Google store billing; server-authenticated webhooks and entitlement reconciliation. [R8]
- Error monitoring: a maintained SDK configured to scrub receipt text, amounts, names, phone numbers, tokens, and image URLs.

Pin compatible stable versions in lockfiles when implementation starts; document target/minimum OS versions and verify native build requirements against current platform policies. Test on current OS releases and representative lower-end supported devices. Do not depend on stale package versions in this brief.

Suggested repository:

```
apps/mobile
apps/api
packages/contracts
packages/receipt-parsers
modules/payment-collector
modules/receipt-ocr
supabase/migrations
tests/fixtures
docs
```

Keep provider parsing isolated from UI, ingestion, and billing. Parser fixtures should document platform, provider, payment flow, observed app version, and whether data is synthetic or a redacted real sample. Native and server normalization rules require parity tests.

## 11. Database and API contract

Core tables:

| Table | Responsibility |
| --- | --- |
| organizations, memberships, invitations | Workspace, ownership, roles |
| payment_sources | Receiving accounts and source capability |
| devices, device_bindings, pairing_sessions | Capabilities, credentials, revocation |
| payment_records | One canonical recorded payment and evidence state |
| payment_proofs, proof_versions | Images, extracted fields, corrections |
| notification_events | Canonical incoming evidence, restricted owner visibility |
| payment_matches | Current/past associations and reason codes |
| audit_events | Actor, action, before/after references, reason |
| plans, subscriptions, billing_events | Products, entitlements, verified store events |
| usage_ledger, credit_ledger | Exactly-once record usage and purchased credits |
| jobs, export_jobs | Durable reconciliation, exports and retry work |

Use UUIDs; all tenant data includes organization_id. Amounts are integer centavos, references are strings, and times are UTC with source precision retained. A transaction identifier is not an integer. Constraints enforce source ownership and one-to-one active associations. Store normalization/parser/matcher versions.

Payment records keep sync status separate from evidence status. A queued scan is not verified, but a formerly matched record viewed offline can show its last synced evidence with a stale-data notice.

Required API capabilities:

- Workspace creation/membership/invites with role checks.
- Pairing creation, acceptance, approval, revoke, source assignment, health reporting.
- Scoped collector batch ingestion with per-item acknowledgements and stable idempotency IDs.
- Proof upload initialization, signed private upload, finalization, and canonical record creation.
- Records list/detail/correction, candidate retrieval, user confirmation, owner manual confirmation, owner unlink/void.
- Asynchronous export creation/status/download with authorization.
- Billing product catalog, usage, subscription status, purchase reconciliation, restore status, and authenticated webhook intake.
- Privacy export, account deletion, workspace deletion, and support diagnostics.

Version the API and return stable error codes. Never expose a Supabase service-role secret or database credential to mobile clients. Collector credentials cannot fetch the owner's ledger or change a record's state.

All server writes validate schemas and tenant membership. All authoritative matching, quota allocation, and subscription state are server-controlled. Rate-limit login, pairing, uploads, event ingestion, exports, and billing reconciliation. Signed image URLs are short-lived.

## 12. Durable synchronization and operational recovery

Create stable client-generated IDs for scans and collector events. Retrying a request or rebooting cannot create a second canonical record or usage charge.

Persist before sending. Acknowledge each batch item individually. Use retry backoff with bounded batches. Do not discard queued notifications because a workspace's scan quota is exhausted.

For the same-phone setup, pending local evidence may be displayed, but the MVP still requires the server to finalize authoritative shared associations. No offline auto-confirmation that could consume a payment already claimed by another device.

For iOS, save scans and share-extension inputs durably, sync while permitted, and retry upon opening/resuming the app. Do not promise guaranteed continuous background uploads on iOS.

Do not call a payment failed when a phone/server is offline. Do not claim to backfill wallet history. Recover only captured/retained events, and show gaps honestly.

The server worker processes reconciliation in a transaction, with idempotency and concurrency constraints. Use periodic recovery for pending jobs, capped retry counts with actionable failures, and monitoring of lag, parse failures, repeated event collisions, and cross-source mismatches.

## 13. Monetization decision and seed products

Sell software access and recorded-payment capacity. Do not charge a percentage of a seller's customer payment. Do not charge for whether a payment passed or failed matching.

Launch with monthly plans plus an optional prepaid record pack. Prices below are proposed product hypotheses, not demonstrated willingness to pay or guaranteed app-store price points.

| Plan | Proposed monthly price | New saved records/month | Scanner devices | Collector devices / receiving sources | Members |
| --- | ---: | ---: | ---: | ---: | ---: |
| Free | PHP 0 | 50 | 1 | 1 / 1 | 2 |
| Solo | PHP 149 | 1,000 | 2 | 1 / 1 | 2 |
| Team | PHP 399 | 5,000 | 5 | 2 / 2 | 5 |

An Android BOTH device uses one scanner slot and one collector slot. The free plan supports the actual remote-owner/cashier workflow; do not make pairing a paid-only feature.

All tiers use the same reconciliation safety rules and include duplicate checks, authorized review, manual confirmation, source health, search, and export of the user's own records. Paid value is capacity, more staff/devices/sources, and longer proof-image retention.

Prepaid pack: proposed PHP 99 for 500 additional saved records. Available without a subscription, so occasional bazaars/seasonal sellers can use the product. A pack does not unlock extra devices or staff. Purchased unused credits do not expire; monthly subscription allowances reset and do not roll over. Apple's rules state purchased IAP credits must not expire. [R9]

Consume the current monthly allowance before prepaid credits. Display both balances. No automatic overage bill or automatic top-up without a separate explicit purchase.

### Billable unit

One unit = one new canonical payment record saved to the workspace, whether created from a receipt or intentionally saved from an incoming event. Merely capturing an incoming notification into the temporary inbox is not a paid record.

One unit is consumed when server creation and quota allocation succeed atomically. The evidence can remain unverified; payment matching is not the billable result.

Do not charge for camera previews, unreadable attempts, cancelled capture, crop/retry, additional evidence for an existing record, duplicate submissions, notification ingestion, matcher retries, status changes, manual review, exports, or viewing records. Bulk import counts each new successfully saved record once.

At quota exhaustion: preserve existing records, exports, collector events, and matching for already saved records. Save additional camera captures as clearly labeled local pending drafts; do not silently discard images or imply shared verification occurred. Show the owner an upgrade/top-up path. Warn at 80% and 100%. Keep a small explicit local draft cap and warn before reaching it.

Use a database usage/credit ledger with unique record/event keys. Deleting or voiding a record does not refund capacity automatically. Correction of a verified duplicate can produce an audited quota adjustment once. Offline client timestamps cannot backdate quota usage into an earlier billing period.

### Subscription implementation

Use native store purchasing for in-app purchases; RevenueCat provides wrappers for StoreKit/Google Play Billing and Expo integration. Verify store entitlements on the server, never grant a plan because a client reports success. [R8]

Owner purchase only; map the verified purchase to exactly one workspace and the correct authenticated billing owner. A restore cannot grant access to an arbitrary second workspace. Prevent duplicate cross-store subscriptions and show the existing subscription's management platform. Test delayed webhooks, renewal, cancellation, grace period, refund/revocation, restore, and consumable purchase replay.

Top-up credit issuance is keyed by unique verified store transaction ID. Process credit-backs/refunds using an auditable ledger without deleting business records. A pending/unverified store purchase grants no paid capacity.

Keep product IDs/prices/features configurable. Show storefront-provided localized prices in the app. No embedded generic PayMongo checkout for mobile digital upgrades by default; any alternative storefront/web checkout model requires a current policy review. Apple distinguishes in-app digital features from free companions to paid web tools. [R9]

Basic revenue illustration, not forecast: 200 Solo workspaces and 100 Team workspaces yield PHP 69,700/month in gross subscription billings before store/billing fees, taxes, refunds, infrastructure, support, and churn.

ML Kit is on-device and offered at no SDK usage charge, so do not justify per-camera-attempt fees as unavoidable AI costs. Budget for native development, storage, bandwidth, backend/realtime, billing infrastructure, app support, and parser maintenance. [R5]

## 14. Retention, privacy, and release safeguards

Proposed defaults:

- Unrelated notifications, OTPs, outgoing notifications, and unknown content: do not retain/upload.
- Captured unacknowledged collector events: encrypted local queue, visibly warn on prolonged backlog; do not promise indefinite or lossless collection. Use a documented bounded local policy and warn before eviction.
- Acknowledged unmatched payment events: owner-restricted retention of 7 days, then purge if never linked/saved.
- Free proof images: 30 days; paid-plan/top-up-created proof images: 90 days. Store each asset's retention entitlement at creation. Downgrading does not unexpectedly shorten a promised existing retention period.
- Structured saved records and matching audit data: 12 months by default, with export and deletion controls. Explain that this is operational recordkeeping, not a tax-record retention guarantee.
- Sensitive temporary exports: expire and delete after 24 hours.

Account/workspace deletion must actually remove relevant personal data, with any necessary exceptions explained and minimized. Staff-account deletion must handle business-owned records without exposing other users or silently deleting a business ledger. Require owner transfer or workspace deletion when deleting the sole owner's account.

Remove location EXIF from uploaded proof images, keep application capture metadata, and do not collect GPS, contacts, installed-app inventories, GCash balance, or device IMEI. Use an app-generated device ID rather than persistent hardware identifiers.

Provide separate prominent disclosures for notification collection/sharing and proof-image storage. Google Play treats financial/payment data as sensitive and requires clear disclosure, secure handling, and account-deletion facilities. [R10]

Use private storage, least-privilege access, encryption in transit, encrypted sensitive local storage, log redaction, limited support access, and monitored admin operations. Do not expose owner personal incoming payments to all staff. A public payment-profile endpoint is not part of the MVP.

Cryptographic hashes establish consistency of captured bytes, not that a screenshot is genuine. A device signature authenticates the registered collector, not GCash's financial ledger. Do not market either as bank-signed evidence.

Prepare app privacy labels/data safety declarations, terms/privacy/support pages, reviewer test accounts and a clearly labeled demo mode for app review, and a real description of Android/iOS capability differences. Demo records must never mix with production totals or billing.

Review provider terms/branding and the precise privacy/business requirements before commercial distribution. The official Android API is not blanket GCash approval. Do not claim affiliation. Do not scrape wallet screens, use Accessibility to operate the wallet, intercept traffic, or store credentials as a shortcut.

## 15. Complete implementation work packages

| Work package | Required outcome |
| --- | --- |
| 1. Foundation | Monorepo, mobile Android/iOS builds, API, auth, migrations, contracts, CI, environment templates |
| 2. Workspace and devices | Roles, sources, secure remote pairing, native permissions, revocation, owner privacy |
| 3. Evidence capture | Camera/import/share extension, OCR, parsers, corrections, encrypted offline storage, private upload |
| 4. Collection | Native Kotlin listener, source filtering, outbox, deduplication, health, fail-safe unsupported flows |
| 5. Reconciliation | Transactional one-to-one matching, candidate review, duplicates, manual confirmation, audit |
| 6. Daily operation | Dashboards, records/search, realtime recovery, offline banners, exports, deletion |
| 7. Monetization | Plans, server quotas, subscriptions, prepaid credits, purchase recovery, usage screens |
| 8. Release | Device integration tests, failure scenarios, monitoring, signed builds, privacy/store materials, runbooks |

This sequence is implementation order, not permission to deliver only the first few packages. Continue to the whole MVP. External secrets, actual provider samples, signing accounts, or store approval that the agent cannot supply must be documented as explicit deployment inputs, never replaced by fake working integrations.

## 16. Acceptance test matrix

The delivery must pass at least these cases:

| Scenario | Required behavior |
| --- | --- |
| Same Android phone scans and collects | Record and event reconcile without double counting |
| iPhone scanner + distant Android collector | Correct workspace update, no local network requirement |
| All-iPhone workspace | Clear recording/manual mode, no imaginary collection |
| Notification arrives before scan | Existing unmatched event becomes candidate/match |
| Notification arrives after scan | Record updates after server evidence processing |
| Receipt payer absent but payee present | Payee never compared to incoming payer |
| Same amount/masked identity/time only | Review, never unconditional auto-confirmation |
| Valid shared reference namespace and exact ID | Automatic match when all other constraints pass |
| Cross-provider references differ | No invented mapping or automatic exact-ID match |
| Three same-amount payments | Distinct candidates; never arbitrary assignment |
| Two cashiers claim one event | At most one active association |
| Same receipt scanned repeatedly | One canonical record and one usage charge |
| Same notification updated/grouped | No duplicate incoming-payment creation |
| Provider reuses notification key | Preserve distinct real events or flag ambiguity rather than losing money evidence |
| Outgoing/pending/failed/OTP/promo | Never accepted as incoming confirmation or uploaded as payment evidence |
| Source account or amount conflict | Review with mismatch explanation |
| Material edit after match | Reconciliation reopened and audit preserved |
| Collector offline then reconnects | Captured durable events retry; no invented history |
| Scanner offline | Durable pending draft, no false shared verification |
| Device force-stopped/revoked | Truthful stale status and rejected revoked uploads |
| GCash open/notifications disabled/grouped/locked-screen | Document observed behavior; missing signal remains unverified |
| Unknown notification format | Fail closed; no fabricated metadata |
| Quota exhausted after proof already saved | Matching continues without new charge |
| Concurrent quota consumption | Never over-allocate the same remaining unit |
| Duplicate or forged billing callback | No duplicate/unauthorized entitlement or credit grant |
| Subscription refund/restore/cancel | Correct workspace entitlement; records retained under policy |
| Staff requests another workspace's data | Denied by API and database/storage boundaries |
| Staff requests owner's full incoming inbox | Denied; minimum candidate data only |
| Retention or account deletion | Expected data removed; no undeclared retained copies |

Use unit and property/concurrency tests for money parsing, reference normalization, state transitions, idempotency, and one-to-one matching. Test authorization with at least two workspaces and multiple roles. Use real-device Android/iOS end-to-end tests for native flows and a labeled synthetic fixture harness for repeatable CI. Synthetic tests do not demonstrate actual GCash notification coverage.

Zero false automatic matches in the defined adversarial test suite is a release requirement, not a public promise of zero fraud. Track automatic coverage, manual-review rate, parse failures, OCR correction rate, delivery lag, duplicate warnings, and actual cloud cost per saved record without collecting sensitive analytics payloads.

## 17. Definition of done and coder handoff

Deliver:

- Runnable mobile app with working Android and iOS builds; actual native modules and iOS share extension.
- Deployed-ready NestJS API and database migrations with constraints/access controls.
- Complete same-phone and remote-phone flows, including iOS scanning against Android evidence.
- Live matching/review states, export, diagnostics, billing, quotas, offline recovery, and privacy controls.
- Unit, integration, concurrency, security, and real-device test instructions/results, marking untested cases honestly.
- README, architecture diagram in text, environment templates, setup/run commands, deployment/runbooks, provider support matrix, and store submission checklist.
- No production mocks, placeholder verification, hardcoded credentials, unrestricted buckets, service-role keys in apps, or silent TODOs in critical paths.

When a real external dependency is missing, finish the surrounding implementation, explicitly disable the unsupported production capability, and document the exact credential/sample/approval still required. Never report a fake listener, mock purchase, or synthetic notification fixture as a verified real integration.

## 18. Official references checked for this brief

Links below document platform capabilities or policies, not approval of this specific product. Provider payload compatibility still requires real samples.

[R1] Android NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService

[R2] Apple UNUserNotificationCenter: https://developer.apple.com/documentation/usernotifications/unusernotificationcenter

[R3] GCash confirmation-channel table: https://help.gcash.com/hc/en-us/articles/10040298426137-Shift-of-SMS-messages-to-GCash-App-Inbox

[R4] Expo native development workflow: https://docs.expo.dev/workflow/overview/

[R5] ML Kit overview and Text Recognition: https://developers.google.com/ml-kit/guides and https://developers.google.com/ml-kit/vision/text-recognition/v2

[R6] Android WorkManager work requests and quotas: https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work

[R7] Android notification security/background behavior: https://developer.android.com/about/versions/15/behavior-changes-all

[R8] RevenueCat Expo integration: https://www.revenuecat.com/docs/getting-started/installation/expo

[R9] Apple App Review Guidelines, sections 3.1 and 5.1: https://developer.apple.com/app-store/review/guidelines/

[R10] Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311

[R11] Google Play policy entry point, including Payments and Subscriptions: https://play.google/developer-content-policy/

[R12] GCash terms: https://gcash.com/terms-and-conditions

Google's detailed Payments policy endpoint could not be retrieved in this research session. Native store billing is the selected implementation path; do not infer eligibility for an alternative billing exemption from that retrieval failure. Recheck applicable storefront policies at submission.
