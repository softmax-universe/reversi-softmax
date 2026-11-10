# Working in Reversi Softmax

Read [.contracts/index.md](.contracts/index.md) before changing behavior.
This workspace owns the engine adapter in `packages/game` and environment composition in `app`. Consume Universe
through public package entry points and immutable release artifacts. Read README for setup and runnable examples.

Use the pinned Mise tools and pnpm. Run `pnpm install --frozen-lockfile`, `pnpm architecture:setup`, and `pnpm check` before delivery.
Keep paid model calls explicit and bounded. Local play and baseline checks work without credentials or an API.
Keep local recordings in ignored `.local/`, preserve completed data, and stop task-owned preview processes after use.

Change contracts only when explicitly requested. Keep contributor instructions self-contained in this repository.
