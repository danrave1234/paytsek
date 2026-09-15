## PayTsek V2 beta — 0.2.6

- Matching now happens immediately: a proof scanned seconds or minutes after its wallet notification is matched by amount and time as soon as it is saved, and a notification arriving after the scan matches on arrival. Previously matching waited for a background job that could be delayed for hours.
- Opening an older record that was never matched now catches it up automatically.
- New Settings › Notifications › "Send test notification": posts a GCash-style incoming-payment notification on this phone so you can confirm the listener catches it end-to-end, then scan a proof for the same amount to see a Possible match.
- Redesigned payment record page: large amount with the wallet logo and evidence status, tappable proof band, compact notification evidence list, and a collapsible history timeline.
- Background refreshes are now silent. The top loading indicator only appears when you pull to refresh.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.
