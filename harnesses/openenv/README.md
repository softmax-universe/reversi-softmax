# OpenEnv

This optional adapter uses [OpenEnv 0.12.0](https://github.com/openenv/OpenEnv/tree/v0.12.0) for persistent WebSocket
sessions. Reset, step, state, and close use one `/ws` connection, as in OpenEnv's native client. HTTP discovery remains
available at `/health`, `/schema`, and `/metadata`. The server uses OpenEnv's production-mode configuration to omit
the stateless HTTP `/reset`, `/step`, and `/state` routes.

The adapter calls the local runtime's direct-session routes. It contains no game rules, policy execution, or score
calculation. The runtime retains every accepted transition and recording.

Start the Reversi local installation first, then set `UNIVERSE_RUNTIME_ENDPOINT` to its loopback origin and
`UNIVERSE_INSTALLATION_CAPABILITY` to that installation's capability. From this directory:

```sh
uv run reversi-openenv
```

`ReversiEnvironment` can also be imported by a training harness. The external harness supplies the action for the
reported participant on each turn, including both seats during self-play. The engine performs automatic passes.
The selected reward seat defaults to black. Reward is unknown until a terminated episode supplies its authoritative
score. Cancelled or interrupted sessions never become a zero-score loss.

Closing a WebSocket cancels its unfinished session while retaining its evidence. A lost runtime mutation response
blocks new work on that environment instance. Native OpenEnv messages do not expose reconciliation: stop the trial
and inspect the retained session through the runtime's standard session client. Store the returned session ID so
accepted work remains inspectable after the wrapper process exits.

When importing the Python `ReversiEnvironment` directly, call `close()` to cancel unfinished work and `reconcile()`
to repeat an unresolved idempotent request with its original submission identity. Reconciliation never chooses a
replacement move or starts another session silently.
