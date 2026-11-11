---
name: reversi-game-authority
message: Keep action validation and outcomes with the pinned game engine.
---

# Game authority

## Rules

Use `reversi@3.0.0` as the rules authority in `packages/game/src/engine/game.ts`. Use its public Board validation,
placement, legal-move, and piece-count operations. The adapter owns the current actor, tick, and terminal flag; derive
passes and termination from the engine's legal-move checks. Keep bounded snapshot/restore in the game package.
Validate restored board counts, actor, terminal state, and derived observation before replacing live state.

Keep the browser and benchmark on the same adapter path. Normalize observations to black/white/null without changing
the engine's legal actions. Preserve actual attempted and accepted actions in recordings.

Import Universe through its public protocol, SDK, runner, and policy packages. Install packed or published packages
without repository source imports or workspace links. Preserve the engine's attribution and original executable.

## Checks

Run `pnpm test` for complete recorded games and rejected-move state preservation. Review imports and `pnpm list` to
confirm the external package boundary. Inspect `packages/game/src/engine/game.ts` when changing turn or outcome handling.
