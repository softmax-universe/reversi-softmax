import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readRunDirectory, runBenchmark } from "@softmax-universe/runner";
import { summarizeRun, type Run } from "@softmax-universe/protocol";
import { firstLegalBaseline } from "@softmax-universe/reversi-game";
import { ReversiGame } from "@softmax-universe/reversi-game";
import { HumanPlay } from "../app/view/human.js";
import { reversiEnvironment } from "../app/environment/index.js";

test("public-package benchmark records complete games that replay through the engine", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "reversi-benchmark-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const run: Run = {
    schemaVersion: 2,
    id: "integration",
    name: "Integration",
    createdAt: new Date().toISOString(),
    kind: "benchmark",
    game: reversiEnvironment.manifest.game,
    configuration: {},
    trials: reversiEnvironment.benchmarks["balanced-seeded-v1"]!.createTrials({
      pairs: 1,
      seed: 42,
      candidates: [{ id: "0", policy: "candidate-0", label: "First legal move" }],
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
    createGame: reversiEnvironment.createGame,
    policies: { ...reversiEnvironment.policies, "candidate-0": firstLegalBaseline },
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
      const result = game.apply(decision.attemptedAction);
      assert.equal(result.accepted, true);
      assert.deepEqual(decision.acceptedAction, result.action);
      assert.deepEqual(decision.nextObservation, result.nextObservation);
    }
    assert.deepEqual(episode.outcome, { kind: "terminated", ...game.getOutcome() });
    const finalBoard = game.observe();
    assert.equal(game.apply({ row: 0, column: 0 }).accepted, false);
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
    assert.deepEqual(game.apply(action), {
      accepted: false,
      action: null,
      nextObservation: before,
    });
  }
});

test("human moves produce an uploadable completed recording and abandoned moves remain incomplete", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "reversi-human-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const play = new HumanPlay(directory);
  await play.recover();
  let game = await play.start("white", 42);
  assert.ok(game);
  while (game.outcome === null) {
    const action = game.observation.legalActions[0];
    assert.ok(action);
    game = await play.move({ gameId: game.id, revision: game.revision, action });
    assert.ok(game);
  }
  const completed = await readRunDirectory(game.recordingDirectory);
  assert.equal(completed.episodes[0]?.outcome.kind, "terminated");
  assert.deepEqual(completed.episodes, play.recording().episodes);

  const active = await play.start("white", 43);
  assert.ok(active);
  const beforeInterruption = play.recording().episodes[0];
  assert.notEqual(beforeInterruption?.id, completed.episodes[0]?.id);
  const restarted = new HumanPlay(directory);
  await restarted.recover();
  const interrupted = await readRunDirectory(active.recordingDirectory);
  assert.deepEqual(interrupted.episodes, [beforeInterruption]);
  assert.equal(interrupted.episodes[0]?.outcome.kind, "incomplete");
  assert.equal(restarted.view(), null);
});
