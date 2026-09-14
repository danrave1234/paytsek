## PayTsek V2 beta — 0.2.3

- Scanned proofs now identify GCash, GoTyme, Maya, or MariBank using receipt text, layout, and OCR confidence.
- Wallet names mentioned only as the recipient are ignored, reducing incorrect source detection.
- Unclear proofs are recorded immediately as Unknown wallet and can be corrected later from record details.
- Record details now distinguish the wallet shown on the proof from the wallet that produced matching notification evidence.
- Fixed a local database connection failure that could prevent a scanned proof from being saved after an app update.
- Save confirmations now appear briefly and include the detected wallet instead of interrupting the workflow.

Wallet detection and notification matching are supporting evidence, not confirmation from a bank or wallet provider.
