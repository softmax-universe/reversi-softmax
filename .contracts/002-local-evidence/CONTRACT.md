---
name: reversi-local-evidence
message: Preserve accepted and incomplete recordings with bounded local work.
---

# Local evidence

## Rules

Checkpoint human decisions before returning success. Preserve completed episodes and interrupted checkpoints.
Distinguish completed, failed, cancelled, truncated, and incomplete play. Upload existing files without replaying a game.

Balance benchmark candidates across both seats with the same seeded reference configuration. Declare model budgets
and endpoints explicitly. Keep provider and upload credentials out of recordings, logs, and browser code.

Bind the human server to loopback, validate hosts and mutation origins, and bound request bodies and decisions.
Keep one active game in memory. Preserve the current board if a request fails.

## Checks

Run `pnpm test` for completed and interrupted recording persistence. Check `pnpm benchmark --help` against the command
parser after changing limits. During server changes, verify a foreign-origin mutation receives 403 and a legal local
move saves evidence before success. Review browser assets and a completed recording for credentials.
