# Reversi through PettingZoo

`ReversiEnvironment` implements the sequential AEC interface over a running Universe installation. It uses the
shared Universe Python client; game rules, pass behavior, rewards, checkpoints, and recordings stay in the runtime.

Actions are board-square indices `row * 8 + column`, from 0 to 63. Observations contain an 8×8 board from the selected
player's perspective and an action mask. A piece belonging to that player is 1, the opponent is -1, and an empty
square is 0. The underlying runtime automatically passes a player with no legal move. Terminal agents receive the
standard final `step(None)` before removal.

Configure `UNIVERSE_RUNTIME_ENDPOINT` and `UNIVERSE_INSTALLATION_CAPABILITY` for the local installation, then run
`uv run --frozen python qualify.py` to exercise PettingZoo's actual API test and a retained complete game.
The operator capability belongs to the trainer/controller; do not expose it inside an untrusted playing policy.

After `UncertainMutation`, use `environment.reconcile()` to recover the original command before choosing another
action. This wrapper supports Reversi AEC stepping; it does not declare a Parallel environment.

The wrapper declares both controllers as bots under its external harness policy ID. Pass `controllers` at construction
for per-seat metadata, for example `{"black": {"kind": "bot", "policy": "candidate", "model": "your-model"},
"white": {"kind": "human", "policy": "human"}}`. These identities are caller-declared and fixed at reset; the
runtime does not invent evidence about inference performed outside it.
