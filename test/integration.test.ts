import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "@softmax-universe/protocol";
import { ReversiGame } from "@softmax-universe/reversi-game";
import { environment } from "../app/environment/index.js";

test("benchmark trials balance each seed across both seats", () => {
  const trials = environment.benchmarks["balanced-seeded-v1"]!.createTrials({
    configuration: { pairs: 2 },
    seed: 42,
    bindings: {
      candidate: { id: "candidate", policy: "candidate" },
      reference: { id: "reference", policy: "reference" },
    },
  });
  assert.equal(trials.length, 4);
  for (const seed of [42, 43]) {
    const pair = trials.filter((trial) => trial.seed === seed);
    assert.equal(pair.length, 2);
    const seats = pair.map(
      (trial) => trial.participants.find((participant) => participant.policy === "candidate")!.id,
    );
    assert.deepEqual(new Set(seats), new Set(["black", "white"]));
  }
});

test("rejected moves preserve the observation and cannot claim an accepted action", () => {
  const game = new ReversiGame();
  const before = game.observe();
  for (const action of [
    { row: -1, column: 0 },
    { row: 0, column: 0 },
    { row: 2.5, column: 3 },
  ]) {
    const result = game.step({ black: action });
    assert.equal(result.accepted, false);
    assert.deepEqual(result.actions, {});
    assert.deepEqual(game.observe(), before);
  }
});

test("checkpoints preserve the next actor, legal moves, and outcome through a full game", () => {
  let game = new ReversiGame();
  for (let moves = 0; moves < 60 && game.getFrame(); moves++) {
    const restored = new ReversiGame();
    restored.restore(JSON.parse(canonicalJson(game.snapshot())));
    assert.deepEqual(restored.getFrame(), game.getFrame());
    const frame = game.getFrame()!;
    const [agent, request] = Object.entries(frame.requests)[0]!;
    assert.equal(request.actionSpace.kind, "enumerated");
    if (request.actionSpace.kind !== "enumerated") throw new Error("Expected enumerated actions");
    const actions = { [agent]: request.actionSpace.actions[0]! };
    assert.deepEqual(restored.step(actions), game.step(actions));
    game = restored;
  }
  assert.ok(game.getOutcome());
});
