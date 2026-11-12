# Reversi Softmax

Run Reversi locally, evaluate a JavaScript or model policy, and inspect retained episodes and model evidence.
The pinned [reversi](https://github.com/kjirou/reversi) engine owns legal moves, automatic passes, and terminal scores.
The environment consumes released Universe packages. Installed baseline play needs no hosted API or cloud account.
Source development requires GitHub read access to the private `softmax-universe/scott-demo-environments` releases.

## Install

Download a complete native archive from [release v0.4.1](https://github.com/softmax-universe/reversi-softmax/releases/tag/v0.4.1).
Use `darwin-arm64` for an Apple silicon Mac or `linux-x64` for Linux on x86-64:

```sh
target=darwin-arm64 # or linux-x64
curl -fL -o "reversi-softmax-0.4.1-$target.tar.gz" \
  "https://github.com/softmax-universe/reversi-softmax/releases/download/v0.4.1/reversi-softmax-0.4.1-$target.tar.gz"
mkdir reversi-softmax-0.4.1
tar -xzf "reversi-softmax-0.4.1-$target.tar.gz" -C reversi-softmax-0.4.1 --strip-components=1
cd reversi-softmax-0.4.1
./universe-local start --release ./release.json --state "$HOME/.local/share/reversi-softmax" --port 4328
```

The archive includes the launcher, pinned Node and celld executables, game Worker, browser assets, and Harbor verifier.
Open the printed local console URL. Use **Play** for a direct session, or create an experiment and bind candidate
and reference policies for a balanced evaluation.
Baseline play needs no account or API key and makes no model calls. Ctrl-C stops the local processes.

Keep state outside the extracted installation, as in the command above. Starting again uses the existing state;
replacing an installation preserves prior results. Treat the printed console URL as a credential.

Model use is optional. To bring your own local or hosted OpenAI-compatible endpoint, follow
[Universe Local's model configuration](https://github.com/softmax-universe/scott-demo-environments/blob/v0.7.0-alpha.2/apps/cli/README.md)
and [compatible endpoint settings](https://github.com/softmax-universe/scott-demo-environments/blob/v0.7.0-alpha.2/adapters/compatible-models/README.md).
Add `--models /absolute/path/to/private-models.json` to startup; the file must be owned by you with mode `600` or stricter.
Credentials stay on the server. Foundation is an optional transport.

## Develop

```sh
mise install
gh auth login
mise exec -- pnpm run setup
mise exec -- pnpm check
```

The game package lives in [packages/game](packages/game/README.md). The application composes that game in
[app/environment](app/environment/index.ts), balanced scenarios in [app/benchmarks](app/benchmarks/index.ts),
the game renderer in [app/view](app/view/console.tsx), and a fixed Worker in [app/worker](app/worker/index.ts).
There is one engine adapter. The runtime, recorder, model transports, policy isolation, and local launcher come
from Universe's checked release artifacts. No hot plugin loader or sibling source imports are used.

`pnpm build` compiles the independent game package, Worker, browser assets, and Harbor verifier. It writes
`dist/application.json` with their byte counts and SHA-256 digests. Release packaging uses these checked outputs
and the exact verified Universe runtime assets. It does not rebuild the runtime during publication.

## Evaluate

The benchmark command submits evaluations to the installed local runtime. Each candidate plays both seats against the
seeded reference. Connect to a running installation:

```sh
pnpm benchmark --state .local/reversi --pairs 2 --seed 42
```

To start and close the installation for this command, supply its release manifest:

```sh
pnpm benchmark --state .local/reversi --release /path/to/release.json --port 4328
```

Model candidates use IDs from the installation's private model configuration. The runtime owns inference transport,
credentials, and call evidence. Supply an explicit total allowance:

```sh
pnpm benchmark --state .local/reversi --model candidate-a --model candidate-b \
  --max-model-calls 256 --max-output-tokens 64 --submission-id comparison-1
```

The allowance is divided evenly across candidates within one experiment. Repeating the same submission ID and inputs
reattaches to its evaluations. The command prints each evaluation ID before waiting. Inspect or export those IDs with
the local console or universe-local commands. The runtime retains results and supported checkpoints after the command
disconnects.

A win scores 1, a draw 0.5, and a loss 0. Incomplete work retains its status. Unknown model calls keep their original
identity and consume their reserved allowance. Baseline evaluation requires no provider credential. Use a new
submission ID for a deliberate new comparison.

The installed local runtime console uses the same environment manifest, policy artifacts, and benchmark definition.
It reads retained evaluation and call evidence through the public runtime-client. The game-specific renderer stays
in this application. Model settings and credentials stay on the server.

`pnpm run setup` authenticates with GitHub through `gh`, verifies the pinned release manifest and every package/wheel,
then installs the checked local archives. Tokens never enter the lockfile. Already installed baseline play stays offline.
The public mirror checks only trusted main pushes; private Factory checks exercise proposed changes.

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
boundary and accumulated intervening rewards. Historical v2 recordings remain readable; local control is `/api/v3`.

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
