# Reversi Softmax

Run Reversi locally, evaluate a JavaScript or model policy, and inspect retained episodes and model evidence.
The pinned [reversi](https://github.com/kjirou/reversi) engine owns legal moves, automatic passes, and terminal scores.
The environment consumes public Universe packages. It needs no private source checkout, hosted API, or cloud account
for baseline use.

## Install

Download a complete native archive from [release v0.3.0](https://github.com/softmax-universe/reversi-softmax/releases/tag/v0.3.0).
Use `darwin-arm64` for an Apple silicon Mac or `linux-x64` for Linux on x86-64:

```sh
target=darwin-arm64 # or linux-x64
curl -fL -o "reversi-softmax-0.3.0-$target.tar.gz" \
  "https://github.com/softmax-universe/reversi-softmax/releases/download/v0.3.0/reversi-softmax-0.3.0-$target.tar.gz"
mkdir reversi-softmax-0.3.0
tar -xzf "reversi-softmax-0.3.0-$target.tar.gz" -C reversi-softmax-0.3.0 --strip-components=1
cd reversi-softmax-0.3.0
./universe-local start --release ./release.json --state "$HOME/.local/share/reversi-softmax" --port 4328
```

The archive includes the launcher, pinned Node and celld executables, game Worker, browser assets, and Harbor verifier.
Open the printed local console URL. Use **Play** for a direct session, or create an experiment and bind candidate
and reference policies for a balanced evaluation.
Baseline play needs no account or API key and makes no model calls. Ctrl-C stops the local processes.

Keep state outside the extracted installation, as in the command above. Starting again uses the existing state;
replacing an installation preserves prior results. Treat the printed console URL as a credential.

Model use is optional. To bring your own local or hosted OpenAI-compatible endpoint, follow
[Universe Local's model configuration](https://github.com/softmax-universe/universe/blob/v0.6.0-alpha.2/apps/cli/README.md)
and [compatible endpoint settings](https://github.com/softmax-universe/universe/blob/v0.6.0-alpha.2/adapters/compatible-models/README.md).
Add `--models /absolute/path/to/private-models.json` to startup; the file must be owned by you with mode `600` or stricter.
Credentials stay on the server. Foundation is an optional transport.

## Develop

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
pnpm architecture:setup
mise exec -- pnpm check
```

The game package lives in [packages/game](packages/game/README.md). The application composes that game in
[app/environment](app/environment/index.ts), balanced scenarios in [app/benchmarks](app/benchmarks/index.ts),
the game renderer in [app/view](app/view/console.tsx), and a fixed Worker in [app/worker](app/worker/index.ts).
There is one engine adapter. The runtime, recorder, model transports, policy isolation, and local launcher come
from Universe's public artifacts. No hot plugin loader or sibling source imports are used.

`pnpm build` compiles the independent game package, Worker, browser assets, and Harbor verifier. It writes
`dist/application.json` with their byte counts and SHA-256 digests. Release packaging uses these checked outputs
and the exact verified Universe runtime assets. It does not rebuild the runtime during publication.

## Evaluate

The default benchmark plays first-legal-move against the seeded reference. Every candidate plays both seats for
each seed, through the same engine and scoring path used by runtime evaluations:

```sh
pnpm benchmark --directory .local/baseline --pairs 2 --seed 42
```

The source benchmark command also supports the optional Foundation adapter. That path requires an explicit endpoint,
token, model, and call budget:

```sh
export FOUNDATION_ENDPOINT=https://foundation.softmax.nexus
pnpm benchmark --directory .local/models --pairs 1 --seed 42 \
  --model openai/gpt-4.1-mini --max-model-calls 128 --max-output-tokens 64
```

The model command spends its supplied grant. Set `FOUNDATION_TOKEN` in the terminal environment using a bounded
grant. `pnpm benchmark --help` lists decision, token, time, and total limits. Local baseline use makes no model calls.
A win scores 1, a draw 0.5, and a loss 0. Incomplete work retains its status and never receives an invented score.
Reusing the same directory retains completed evidence and resumes supported incomplete episodes from checkpoints.
Unknown model calls keep their original identity and never trigger replacement paid work. Choose a new directory for a new
attempt or different bounds. Model inference is injected through the public Foundation adapter.

The installed local runtime console uses the same environment manifest, policy artifacts, and benchmark definition.
It reads retained evaluation and call evidence through the public runtime-client. The game-specific renderer stays
in this application. Model settings and credentials stay on the server.

Source development uses the same launcher through `pnpm local start`. Use the release manifest from a complete
checked installation.

The shared environment-tools package builds browser assets, embeds them through universe:assets, and assembles
checked native distributions. universe.json declares the compatibility date and optional Harbor command. The
[package graph](package-boundaries.json) and source-lane checks keep the portable game, browser, Node, and Worker
owners separate.

Use `mise install --locked` to keep the checked toolchain. Regenerate `mise.lock` with Mise `2026.8.12`,
matching the workflow manager.

## Human play

Human play uses the same installed Worker, checkpoint state, and local console as automated evaluation:

```sh
pnpm play --release /absolute/path/to/release.json --state /absolute/path/to/private-state --port 4328
```

Open **Play**, create a session with a seed, and select the requested agent's legal move. This is hotseat play; baseline
and model policies run through evaluations. The console can reattach by session ID. Each accepted batch has a stable
submission receipt and game checkpoint. Restart the same installation/state to retain confirmed work. The previous
standalone human server has been removed; existing recording directories remain readable as historical evidence.

The original engine terminal game is available with `pnpm --filter @softmax-universe/reversi-game exec reversi`.
See [third-party notices](THIRD_PARTY_NOTICES.md) for attribution and the exact engine pin.

## External harnesses

[The Harbor task](harnesses/harbor/README.md) asks an external agent to write a bounded JavaScript policy. Its verifier
freezes the policy, runs eight balanced games through the runtime, and exports accepted recordings. The bundled
Pi author stays idle while Harbor owns the trial.

[The OpenEnv adapter](harnesses/openenv/README.md) uses OpenEnv's native server and forwards reset, step, state, and
close operations to the runtime's direct-session API. The external harness controls the reported participant's
moves. It implements no game rules or scoring and retains uncertain requests under their original submission IDs.

[The PettingZoo adapter](harnesses/pettingzoo/README.md) exposes Reversi AEC stepping with board-square actions and a
legal-action mask. It obtains turns, automatic passes, and final rewards from the same runtime. OpenEnv and PettingZoo
share the released Universe Python control client; neither contains another engine or retries uncertain moves.

To build on this example, clone the public source at its release tag, keep the contracts and runtime composition,
and replace the portable engine adapter and renderer. Implement `getFrame`, `step`, `getOutcome`, and bounded
snapshot/restore. Benchmarks declare named policy slots and own their configuration; policies receive explicit memory
and per-agent action spaces. Reversi is the maintained starter, with no separate generated template copy.

## Saved recordings

The runner's public upload and dataset commands read existing recordings without replaying or calling a model:

```sh
pnpm universe upload .local/baseline \
  --endpoint http://127.0.0.1:4310 --project demo --key-env UNIVERSE_WRITE_TOKEN
pnpm universe dataset export <run-id> --out .local/dataset.json \
  --endpoint http://127.0.0.1:4310 --project demo --key-env UNIVERSE_READ_TOKEN
```

Uploads need an explicit project credential. Recordings are private data; downloading one does not grant
redistribution or training rights. Keep the recording directory after a storage failure.

The self-contained product contracts are in [.contracts](.contracts/index.md). Checks run complete games through
published package boundaries, replay accepted transitions through the engine, and preserve completed and interrupted
human recordings. They do not duplicate the engine's rules suite.

Recording v3 includes frame boundaries, stable decisions, all-agent transition observations, and rewards. The local
console and `universe-local export --format trajectories` project per-agent JSONL using that agent's next decision
boundary and accumulated intervening rewards. Historical v2 recordings remain readable; local control is `/api/v2`.

A private model file can bind a local compatible endpoint without any Softmax account:

```json
{
  "models": [
    {
      "id": "local-policy",
      "api": "openai-completions",
      "baseUrl": "http://127.0.0.1:8000/v1",
      "model": "your-local-model"
    }
  ]
}
```

For Foundation inference, use `api: "foundation"`, its explicit gateway origin as `baseUrl`, and a bounded grant as
`apiKey`. Foundation game bindings cannot be author bindings. Keep the file private and pass it through `--models`;
model aliases appear in the console while credentials and endpoints stay on the server.
