## PayTsek V2 beta — 0.2.15

- More reliable offline saving and sync, with safer retries when switching accounts or workspaces. Unsynced proofs remain on the phone.
- Today totals now avoid counting a scan twice after an interrupted sync and follow the workspace's local date.
- Clearer sync, offline and account-deletion states; safer staff access and CSV exports.
- Listener checks are now local diagnostics only and can never create payment matches.
- Improved receipt-image validation, amount-conflict checks and automatic-capture safeguards.
- Background matching, deletion retries and release verification are more robust.

PayTsek remains free beta. A Strong match is supplementary notification evidence,
not bank confirmation or a wallet balance. Android and wallet apps can delay or
omit notifications; proof capture remains available without them. New bank feeds
and optional third-party error monitoring are not enabled by this update.

## PayTsek V2 beta — 0.2.14

- A notification that was already recorded now becomes a Strong match automatically when it is the one safe exact-amount and nearby-time candidate.
- Matching is fully server-authoritative: the phone no longer chooses a notification before ambiguity, timing, edits, source, and approval rules are checked.
- Multiple or conflicting candidates remain Possible match and still need review.
- Scan confirmation now says wallet evidence is being checked, and evidence wording is consistent across Today, Records, Settings, the web dashboard, Support, and Updates.
- You can open Scan automatically at app launch or use the Android launcher shortcut. Optional auto-capture waits for two matching, clearly readable receipt frames; manual capture remains available.
- Rejected auto-capture frames are deleted locally, and accepted proofs still save on the phone before upload or evidence matching.
- Owner and cashier access is now enforced by the API: cashiers see only their own records and totals, while team administration and workspace-wide data remain owner-only.
- Wallet evidence uploads now retry correctly after temporary network or server failures, restore health checks after reboot, and show battery-optimization guidance in Settings.
- The beta backend now supports signed evidence connectors for future provider or payment-partner webhooks, while notification evidence remains optional and proof records remain primary.

A Strong match is supplementary payment evidence, not confirmation of a wallet balance or settlement by a bank or wallet provider.


## PayTsek V2 beta — 0.2.13

- Auto-matching is more reliable: payment records are linked to wallet notifications automatically when the amount and time match, even when the notification arrives before the scan.
- The phone now passes locally matched notifications to the server for instant linking.
- Proof uploads retry automatically on transient failures instead of failing permanently.
- Opening a record no longer re-checks for matches on every refresh, reducing unnecessary sync activity.
- Day-close summary now shows the correct breakdown: Recorded, Possible match, Strong match, and Owner confirmed.
- Multiple candidates or contradictory data still need your choice.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.


## PayTsek V2 beta — 0.2.11

- Payment records now sync instantly: pending wallet notifications are uploaded before the record is created, so the server can match them immediately.
- Auto-matching works for real wallet notifications even when the receipt has a reference number the notification does not.
- Multiple candidates still need your choice. Contradictory data or edited records stay in review.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.


## PayTsek V2 beta — 0.2.10

- Auto-matching now works for real wallet notifications even when the receipt has a reference number the notification does not. A single clear amount and time match is linked automatically.
- Proof uploads are more reliable — brief retries handle storage delays so scans no longer fail to sync immediately.
- Multiple candidates still need your choice. Contradictory data or edited records stay in review.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.


## PayTsek V2 beta — 0.2.9

- Payment records now automatically connect to a wallet notification when the amount and time match, instead of requiring a manual tap. Multiple candidates still need your choice.
- Wallet notifications are stored on the phone as soon as they arrive, then matched to a scan by amount and time. You can see a Possible match on the review screen even before the server finishes.
- The receiving wallet source is now adopted onto the record when a match is found, so the record shows which wallet received the payment.
- Restrained animations on new records appearing, dashboard totals updating, and interactive elements (press feedback, fade-in, chart bars). Honors the system reduced-motion setting.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.


## PayTsek V2 beta — 0.2.8

- Wallet notifications are stored on the phone as soon as they arrive, then matched to a scan by amount and time. You can see a Possible match on the review screen even before the server finishes.
- Permissions checklist in Settings shows whether camera, photo library, notification access, and wallet listening are ready.
- Day-close summary on Today, a soft duplicate-proof warning when a similar scan was just recorded, and a privacy-safe Report a problem screen with diagnostics only.

Wallet detection and notification matching are supporting evidence, not confirmation from a wallet provider.
