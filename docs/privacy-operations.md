# Privacy and regulatory readiness register

Reviewed 2026-10-04. This is an engineering assessment and operating procedure,
not legal advice, a registration certificate, or a claim of worldwide compliance.

## Current decision and release gates

The developer confirmed on 2026-10-04 that no operating business is registered.
The natural person/legal entity responsible for the service, service address,
privacy lead and monitored support mailbox have not been verified. Incorporation
alone is not the test for privacy obligations; an individual operator can have
obligations too. Do not invent a company name, DPO, registration number or approval.

Safety fixes may be tested and delivered to existing installations. Before
expanding real-user processing, the operator must complete this register and
obtain appropriate Philippine professional advice. Do not enable paid billing,
new bank feeds, or optional third-party monitoring as a side effect of deployment.
Public beta remains free; technical protections do not make missing organizational
controls complete. Do not advertise “BSP approved”, “NPC certified” or “GDPR compliant”.

| Required decision/evidence | Status | Accountable party |
| --- | --- | --- |
| Identify actual operator, service address and privacy contact; test mailbox | OPEN | Developer/operator, not yet identified in notice |
| Determine registration, tax and local business-permit obligations for actual operation | OPEN | Operator with Philippine counsel/accountant |
| Record intended countries and controller/processor roles with merchants | OPEN | Operator |
| Approve PIA and lawful bases per purpose; employee/customer notice | OPEN | Operator/privacy lead |
| NPC DPO/DPS registration or applicable exemption/declaration analysis | OPEN | Operator/privacy lead |
| Provider DPAs, regions, transfer safeguards and deletion terms | OPEN | Operator |
| Real-device regression, restore exercise and breach tabletop | OPEN until dated evidence exists | Release/incident owner |
| Contracted provider adapter and BSP boundary assessment | NOT ENABLED | Operator/provider/legal reviewer |
| Sentry DPA/region/retention/notice review and tested alert recipient | NOT ENABLED by default | Operator |

## Applicable-law triage

Philippines is the primary product context. The [Data Privacy Act](https://privacy.gov.ph/data-privacy-act/)
requires purpose limitation, proportionality, a lawful basis, security and
accountability, including for outsourced processing. Permission to use a camera
or Android notification access is not itself a lawful basis for all processing
of customers' or employees' data. Map the operator's service purposes separately
from a merchant's recordkeeping purposes; retain the decision and relevant
agreements. Do not assume financial data is always a statutory sensitive-data
category; receipts can nevertheless contain sensitive information and pose risk.

The [NPC registration circular](https://privacy.gov.ph/wp-content/uploads/2023/05/Circular-2022-04-1.pdf)
includes the 250-person employment criterion, sensitive data of at least 1,000
individuals, and likely risk to rights/freedoms. These are alternatives, not a
blanket exemption for a small/free beta. Document counts, processing risks, DPS,
DPO appointment, applicable filing deadlines and evidence of filing or the
appropriate exemption/declaration process. Status here is unresolved, not exempt.

For another country, check actual establishment, targeted users, monitoring,
data categories and local consumer/employment rules before launch:

| Jurisdiction | Trigger to assess | Additional review |
| --- | --- | --- |
| EEA | EU establishment, or offering services to people in the Union/monitoring behaviour there; payment is not required | GDPR lawful bases, processor terms, individual rights, representative/DPO if required, international transfers |
| UK | UK establishment or relevant targeting/monitoring in the UK | UK GDPR/DPA scope, representative, ICO obligations and transfer mechanism |
| California | Covered business nexus and statutory thresholds, including adjusted monetary thresholds | CCPA/CPRA applicability, notices, rights and service-provider contract terms |
| Other markets | Actual launch/processing nexus | Country-specific privacy, consumer, employment, financial and tax review |

Sources: [GDPR Articles 3, 12–22, 28, 32–35 and Chapter V](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng),
[ICO scope guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/who-does-the-uk-gdpr-apply-to/),
[California coverage FAQ](https://cppa.ca.gov/faq) and
[adjusted monetary thresholds](https://www.cppa.ca.gov/regulations/cpi_adjustment.html).
Worldwide accessibility alone is not a completed applicability assessment.
Do not treat GDPR as a universal substitute for other jurisdictions' laws.

PayTsek does not move funds. Nevertheless, any new payment initiation, QR
acceptance, routing, acquiring or settlement capability needs an activity-based
BSP assessment before implementation/enablement. See the existing
[provider and BSP review](evidence-connectors-and-ph-readiness.md), including
[Circular 1049](https://www.bsp.gov.ph/Regulations/Issuances/2019/c1049.pdf).
“Recordkeeping only” is a product boundary, not a license exemption opinion.

## PIA: current processing and risks

| Flow / necessary data | Control | Residual risk / verification |
| --- | --- | --- |
| Sign-in: account ID, email, optional Google identity | Supabase Auth; mobile SecureStore; exact callback allowlist | Verify OAuth branding, access controls, mailbox and deletion in staging |
| Proof capture: image, restricted OCR, amount/time/issuer | On-device OCR; private files/SQLite first; EXIF removed; bounded decode; signed private links | A receipt can contain more than needed. Inform merchants; do not log or reuse OCR for marketing/training |
| Android evidence: allowlisted incoming-event fields | Local rejection of unrelated content; encrypted native queue; diagnostic isolated | OS/provider delivery is not guaranteed; disclose possibility of delay/missing evidence |
| Staff workflow: membership/record authorship | Server authorization plus staff-scoped RLS; no general payer search | Shared/lost phones require screen lock and membership revocation |
| Offline scans and sync | Account/workspace-bound leases; stale requests fenced; unowned old drafts need explicit recovery | App uninstall/device loss can lose unsynced evidence; online permissions must be rechecked at upload |
| Audit/security | Fixed event codes and minimal identifiers; no raw notification logs | Privileged DB/admin access needs access review and incident evidence |
| Optional monitoring | Explicit enable flag + DSN; event allowlist; no replay/native dumps/attachments | Network provider sees transport metadata; DPA/notice/region review required first |

Residual-risk acceptance, reviewer/date and review trigger: **NOT SIGNED OFF**.
Reassess after incidents, new providers, new countries, monitoring changes or
material retention/auth changes. Do not add data to “help analytics”.

## Retention schedule: actual behaviour

| Data | Current rule | Operator action |
| --- | --- | --- |
| Unlinked incoming events | Scheduled purge after 7 days | Verify worker progress and failed jobs |
| Private proofs | Beta default 30 days; expiry fixed on save | Verify object bytes and database metadata deletion |
| Structured records/audit | 12-month eligibility report only; automatic purge is blocked | Approve legal-hold, tax/business and merchant notice policy before enabling a scoped deletion implementation |
| Export objects | 24-hour expiry | Worker deletes expired files; links have shorter validity |
| Account identity | Access blocked immediately; durable Auth deletion retried | Monitor job to completion; retained workspace authorship is cleared |
| Unsynced local scans | Kept until durable server acknowledgment; not cache | Explain local-only copies before sign-out/account deletion; never silently erase them |
| Backups | Provider/backup-policy dependent, not yet verified | Record actual retention, encrypted storage and reapply deletion ledger on restore |

There is no automatic 12-month record-purge promise. An account deletion is not
proof that all personal data embedded in other people's receipts was erased.
Record-specific erasure/restriction needs a scoped, authorized review. PayTsek is
not a statutory accounting archive; merchants must preserve required records
separately. This schedule must be approved and reflected in public notices.

## Subprocessor/service register

| Service | Purpose / data | Verification still required |
| --- | --- | --- |
| Supabase | Auth, Postgres, private proofs/exports | Contract/DPA, actual project region, backup/object retention, support access, subprocessors |
| Vercel | API/web hosting and infrastructure logs | Contract/DPA, actual processing/log regions and retention, spend controls |
| Google | Optional sign-in; bundled on-device ML Kit | OAuth terms, identity data flow, SDK disclosures; no cloud OCR upload is implemented |
| GitHub | Source, CI, signed public APK/checksum | CI secret access and logs; never put real receipts or personal fixtures in Actions |
| Sentry (disabled) | Fixed error code, release and app/API surface only | Contract/DPA, region/retention/alert owner before activation; transport metadata still exists |
| Provider connectors (disabled) | Minimal signed payment evidence | Written agreement, purpose/lawful basis, event/reversal semantics, BSP/NPC review |

No new subprocessor is approved merely by being listed here. Store executed
agreements and region evidence in restricted operator records, not this public repo.

## Data-subject request procedure

1. Accept requests through the existing support address and authenticated app
   privacy controls. Verify the mailbox and assign a real handler before expansion.
2. Log a request ID, receipt date, applicable jurisdiction/deadline, scope and
   handler in a restricted register. Do not put request contents in GitHub issues.
3. Verify identity proportionately through existing authenticated access where
   possible. Do not routinely demand passports, OTPs or wallet credentials.
4. Distinguish account data from merchant-controlled evidence and protect other
   people's information. Coordinate with the merchant where legally appropriate.
5. Export/correct/restrict/erase according to the verified scope and lawful
   exceptions; review retained proofs and backups separately from Auth deletion.
   The app's capped privacy export is a convenience, not proof of a complete DSR.
6. Record action, exceptions, recipient, completion date and any appeal/regulator
   route. An internal target is acknowledgment within 7 days and completion
   within 30 days, but the applicable legal deadline controls. Where GDPR applies,
   assess its one-month response rule and permitted extension/notice conditions.
7. Verify the deletion job, revoke access immediately, and retain only necessary
   accountability evidence with approved retention. Never claim completion while
   a worker is failed or an external processor action is pending.

## Breach assessment: first 72 hours

Use [NPC breach guidance](https://privacy.gov.ph/pips-and-pics/breach-reporting/)
and the applicable law; a notification decision is not postponed until debugging
finishes. Keep a restricted incident register, including decisions not to notify.

- Immediately: record discovery/knowledge time and evidence; assign an incident
  lead and privacy/legal reviewer. Contain exposure, revoke affected credentials,
  preserve necessary forensic evidence without copying receipt text into logs.
- First hours: establish affected systems, categories/people, unauthorized access,
  risk and processor involvement. Separate service outage from personal-data breach.
- Within the legal notification window: assess NPC and individual notice triggers;
  where required submit available information within 72 hours and supplement it.
  A lack of complete facts is not an automatic extension. If EU/UK law applies,
  assess its separate regulator/individual notification standards too.
- Communicate facts and protective steps through verified channels. Do not include
  other customers' data. Record notices, timestamps, rationale and follow-up.
- Recover safely, verify tenant boundaries and deletion state, conduct a review,
  and update the PIA. Schedule and record a tabletop before beta expansion.

Named incident/privacy lead and backup: **OPEN**. No tabletop or legal sign-off
is represented as completed by this document.
