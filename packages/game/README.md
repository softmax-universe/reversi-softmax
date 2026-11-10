# Reversi game

The pinned `reversi@3.0.0` engine decides legal actions, automatic passes, piece counts, and terminal scores.
`ReversiGame` adapts it to the public Universe `GameSession`. Actions use zero-based `{ row, column }` coordinates.
The package also supplies the deterministic seeded and first-legal reference policies.

Browser code imports action and observation validators from `@softmax-universe/reversi-game/validation`, which
loads no engine. Runtime composition imports the main package entry point. App composition, persistence, HTTP, model providers, and benchmark selection live
with the environment application. The original engine executable remains available with `pnpm exec reversi`.
See [third-party notices](THIRD_PARTY_NOTICES.md) for attribution and the exact upstream pin.
