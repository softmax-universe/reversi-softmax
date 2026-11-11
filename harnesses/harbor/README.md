# Harbor

The [write-policy task](write-policy/instruction.md) makes the external Harbor agent write a bounded JavaScript
policy. Its verifier submits the immutable policy to the local runtime, uses the environment's balanced benchmark,
and exports the accepted recording. It reserves no model calls and never starts a bundled author conversation.

Load the checked Reversi Linux OCI archive, then inspect the image name printed by Docker to obtain its immutable ID:

```sh
docker load --input reversi-softmax-0.4.0-linux-x64.oci.tar
docker image inspect <image-name-printed-by-load> --format '{{.Id}}'
pnpm harbor:prepare --to /tmp/reversi-write-policy --image sha256:<loaded-image-id>
uv run --no-project --with harbor==0.25.0 harbor run --path /tmp/reversi-write-policy --agent oracle --env docker --n-concurrent 1 --max-retries 0
```

The prepared task pins that exact image ID. A registry image pinned by manifest digest is also accepted. The image
provides `/opt/reversi/bin/reversi-harbor-verify`. That command starts the bundled local
runtime, invokes the public runtime-client verifier, preserves the verifier's state and recordings, and stops its
owned processes. Preparation refuses a floating tag or an existing destination. No task is advertised as runnable
until the selected image and its runtime closure have passed release qualification.

[Harbor's task format](https://docs.harborframework.com/tasks/overview) owns the outer trial. The verifier writes
the success reward under `/logs/verifier/`; the game average is included only for a fully completed evaluation.
Source, seeds, reference policy, threshold, and verifier are public. This task is not a hidden leaderboard.
