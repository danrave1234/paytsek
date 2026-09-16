## PayTsek V2 beta — 0.2.7

- Opening a payment record now re-checks for new notification matches every time, not just once. If a wallet notification arrives after you scan, the record will show the Possible match when you open it.
- Duplicate wallet notifications (re-posted by Android) now also trigger matching instead of being silently ignored.
- Matching time windows are proven correct: amount-only matches use a 15-minute capture-time fallback when the receipt time is unavailable, ensuring notifications that arrive minutes before the screenshot still connect.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.
