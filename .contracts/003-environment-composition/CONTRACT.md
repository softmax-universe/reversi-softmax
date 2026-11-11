---
name: reversi-environment-composition
message: Compose the game through immutable public Universe packages and shared environment tooling.
---

# Environment composition

## Rules

Expose environment and createSessionTrial through the named app/environment entry point. Use universe.json with
the shared environment-tools build and native assembler; keep Worker composition to createRuntimeObject and
createRuntimeWorker({ assets }). Keep serialized identity and benchmark revisions in its
manifest. Resolve functions and policies at build time. Keep the engine, observation, action, and reference policies
with `packages/game`; runtime composition does not decide game rules.

Use the same game and benchmark definitions for runtime evaluations and external harnesses. Declare candidate and reference policy slots; either may select a configured policy. Balance both seats using the
game-owned pair count. Treat an incomplete episode as incomplete evidence, with no invented score.
Keep public scenarios and their verifier inside this workspace. The benchmark command and Harbor verifier submit
evaluations through the local runtime client. They never open games, configure inference transports, or write checkpoints.

Import Universe through public exports from packed or immutable published artifacts. Release source uses immutable
release URLs and locked integrity. Keep private directories and sibling source imports outside the application.

Keep browser code in app/view and Worker composition in app/worker. Use the shared local console for human play.
Declare the two packages and their exact internal edge in package-boundaries.json. External Python harnesses use the
released Universe Python Session handle for control, confirmed state, uncertain-command identity, reconciliation, and
close. They translate actions and
observations without implementing game transitions, persistence, or a scheduler.

## Checks

Run `pnpm check` to build the independent game package and replay recorded games through the engine. Review
`app/environment` and the release dependency pins together. Exercise external harnesses against the actual local
runtime and inspect their accepted recording evidence before qualifying a release.
