import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL(import.meta.resolve("@softmax-universe/protocol/schemas/direct-session.schema.json")),
);
const checked = await readFile(
  "harnesses/openenv/src/reversi_openenv/schemas/direct-session.schema.json",
);
assert.deepEqual(
  JSON.parse(checked),
  JSON.parse(source),
  "OpenEnv's checked receipt schema differs from the pinned protocol package.",
);
