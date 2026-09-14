# Receiving-notification research — 2026-09-14

## Conclusion

PayTsek must treat notification text as versioned, supplementary evidence rather than a stable provider API.

For current GCash Android pushes, the supported shape is:

- title: `You have received money in GCash!`
- body: `You have received PHP [amount] of GCash from [masked name] [sender number].`
- no customer receipt reference is assumed

The payer's screenshot can show a transaction reference, but the recipient push does not expose the same value. PayTsek therefore records the notification and offers same-source, exact-amount, nearby-time candidates for review. It does not automatically create a Strong Match.

## Evidence

- [GCash Help Center: confirmation messages may arrive through SMS, App Inbox, or push depending on the transaction](https://help.gcash.com/hc/en-us/articles/10040298426137-Shift-of-SMS-messages-to-GCash-App-Inbox). This means one historical SMS format must not be treated as the Android push contract.
- [A publicly indexed March 2026 GCash Android notification sample](https://www.facebook.com/groups/1941416252959957/posts/2437557640012480/) uses `You have received money in GCash!` and includes the received amount, masked sender name, and sender mobile number without a reference number.
- [A 2023 Philippine FOI request](https://www.foi.gov.ph/requests/1-received-4k-from-unknown-person-using-gcash/) quotes an older received-money message containing a new balance and `Ref. No.`. This is retained only as a legacy parse shape, not as evidence that current pushes contain the reference.
- [GCash's current missing-payment guidance](https://help.gcash.com/hc/en-us/articles/61819791535129-Did-not-receive-money) tells users to obtain QRPH references from the app inbox/transaction flow. It does not promise that the recipient's Android banner contains the payer receipt reference.

The GoTyme, Maya, and MariBank parsers remain limited to the redacted incoming templates already supplied for development. None exposes a comparable customer receipt reference, so all remain review-only.

## Product rule

1. Record the proof even when no notification exists.
2. Accept notifications only from an allowlisted Android package and a recognized incoming template.
3. Use the receiving source, exact PHP amount, and nearby time to propose candidates.
4. Never auto-confirm an amount/time-only candidate.
5. Keep raw notification text on-device inside the restricted ingestion flow; upload only parsed fields and a normalized-text hash.
