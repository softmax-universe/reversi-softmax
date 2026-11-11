---
name: reversi-local-evidence
message: Preserve accepted and incomplete recordings with bounded local work.
---

# Local evidence

## Rules

Checkpoint human decisions before returning success. Preserve completed episodes and interrupted checkpoints.
Distinguish completed, failed, cancelled, truncated, and incomplete play. Upload existing files without replaying a game.

Balance benchmark candidates across both seats with the same seeded reference configuration. Declare model budgets explicitly and select models from the runtime's explicit endpoint configuration. Keep provider and upload credentials out of recordings, logs, and browser code.

Use the Universe installation and direct-session operations for local play. Preserve exact command identities after
uncertain delivery. Reattach to saved sessions; do not reconstruct games by replaying the entire history. The runtime
owns loopback authorization, durable receipts, checkpoints, budgets, and state. Keep the last confirmed board visible
when a controller cannot establish the next result.

Declare external controllers when creating a direct session. Keep human console play distinct from trainer/bot play.
Treat supplied policy/model identities as caller-declared; only the runtime's own model adapter records observed
inference. Report the game's actual per-step rewards, including known zero rewards, without inventing terminal scores.

## Checks

Run `pnpm test` for completed and interrupted recording persistence. Check `pnpm benchmark --help` against the command
parser after changing limits. Run the native qualification for duplicate steps, retained close, restart, and the actual OpenEnv/PettingZoo protocols. Review browser assets and a completed recording for credentials.
