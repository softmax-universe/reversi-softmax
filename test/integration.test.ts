import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readRunDirectory, runBenchmark } from "@softmax-universe/runner";
import { canonicalJson, summarizeRun, type Run } from "@softmax-universe/protocol";
import { firstLegalBaseline } from "@softmax-universe/reversi-game";
import { ReversiGame } from "@softmax-universe/reversi-game";
import { environment } from "../app/environment/index.js";

test("public-package benchmark records complete games that replay through the engine", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "reversi-benchmark-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const run: Run = {
    schemaVersion: 3,
    id: "integration",
    name: "Integration",
    createdAt: new Date().toISOString(),
    kind: "benchmark",
    game: environment.manifest.game,
    configuration: {},
    trials: environment.benchmarks["balanced-seeded-v1"]!.createTrials({
      configuration: { pairs: 1 },
      seed: 42,
      bindings: {
        candidate: { id: "0", policy: "candidate-0", label: "First legal move" },
        reference: { id: "reference", policy: "seeded-uniform-v2" },
      },
    }),
  };
  assert.deepEqual(
    run.trials.map((trial) => ({
      seed: trial.seed,
      seat: trial.participants.find((participant) => participant.policy === "candidate-0")?.id,
    })),
    [
      { seed: 42, seat: "black" },
      { seed: 42, seat: "white" },
    ],
  );
  await runBenchmark({
    run,
    directory,
    createGame: environment.createGame,
    policies: { ...environment.policies, "candidate-0": firstLegalBaseline },
    limits: {
      maxDecisionsPerEpisode: 60,
      maxModelCalls: 0,
      maxModelCallsPerDecision: 1,
      maxOutputTokens: 64,
      decisionTimeoutMs: 1000,
      episodeTimeoutMs: 10000,
      runTimeoutMs: 30000,
    },
  });
  const saved = await readRunDirectory(directory);
  assert.equal(saved.episodes.length, 2);
  assert.ok(summarizeRun(saved.run, saved.episodes).every((row) => row.completed === 2));
  for (const episode of saved.episodes) {
    const game = new ReversiGame();
    for (const decision of episode.decisions) {
      assert.deepEqual(decision.observation, game.observe());
      const result = game.step({ [decision.participantId]: decision.attemptedAction });
      assert.equal(result.accepted, true);
      assert.deepEqual(decision.acceptedAction, result.actions[decision.participantId]);
      assert.deepEqual(decision.nextObservation, result.observations[decision.participantId]);
    }
    assert.deepEqual(episode.outcome, { kind: "terminated", ...game.getOutcome() });
    const finalBoard = game.observe();
    assert.equal(game.step({ black: { row: 0, column: 0 } }).accepted, false);
    assert.deepEqual(game.observe(), finalBoard);
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
