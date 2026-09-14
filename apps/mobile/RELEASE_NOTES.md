## PayTsek V2 beta — 0.2.4

- Faster and more reliable saving: a scanned proof is stored on your phone first, and a save that fails now tells you exactly what to fix instead of doing nothing.
- Sharing a screenshot into PayTsek no longer risks recording the same proof twice, and scans made offline now upload on the next app start.
- App updates downloaded in-app are now verified against the release checksum before installing.
- New sign-ins can now choose between creating a workspace or joining with an invite code.
- Theme setting now cycles System, Light, and Dark.
- Records, Review, and Analytics fixes: full pagination in Review, consistent evidence labels (Recorded, Possible match, Strong match, Owner confirmed, Voided), and workspace-timezone times everywhere.
- Owners can now rename a workspace and change its timezone; several team, invite, device, and export actions show clear progress and errors instead of failing silently.
- Notification listening is more resilient: captured payments are never dropped silently, uploads retry properly, and the listener recovers from storage corruption instead of stopping.
- Many smaller performance improvements across Today, Records, and scanning.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.
