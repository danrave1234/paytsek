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
