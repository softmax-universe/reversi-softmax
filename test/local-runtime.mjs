import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { parseArgs, promisify } from "node:util";
import { launchEnvironment } from "@softmax-universe/installation";
import { ReversiGame } from "@softmax-universe/reversi-game";
import { verifyPolicy } from "../dist/verification/index.js";

const { values } = parseArgs({
  options: {
    release: { type: "string" },
    output: { type: "string" },
    python: { type: "string" },
    "pettingzoo-python": { type: "string" },
  },
});
if (!values.release || !values.output)
  throw new Error(
    "Use --release <release.json> --output <new evidence directory> [--python <OpenEnv Python>].",
  );
const output = resolve(values.output);
await mkdir(output, { recursive: false });
const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const port = socket.address().port;
await new Promise((done, reject) => socket.close((error) => (error ? reject(error) : done())));
const options = {
  releaseManifest: resolve(values.release),
  stateDirectory: `${output}.private-state`,
  port,
};
const report = { status: "running", checks: [] };
let runtime;
try {
  runtime = await launchEnvironment(options);
  const client = runtime.client;
  const environment = await client.getEnvironment();
  assert.equal(environment.manifest.id, "reversi-softmax");
  assert.equal(environment.authorEnabled, false);
  const experiment = await client.createExperiment({
    submissionId: "native-reversi-experiment",
    name: "Offline Reversi qualification",
    budget: { maxModelCalls: 0 },
  });
  let evaluation = await client.submitEvaluation({
    submissionId: "native-reversi-baseline",
    experimentId: experiment.id,
    benchmarkId: "balanced-seeded-v1",
    policies: {
      candidate: { kind: "baseline", policyId: "first-legal" },
      reference: { kind: "baseline", policyId: "seeded-uniform-v2" },
    },
    seed: 42,
    configuration: { pairs: 1 },
    limits: {
      maxDecisionsPerEpisode: 60,
      maxModelCalls: 0,
      maxModelCallsPerDecision: 1,
      maxOutputTokens: 64,
      decisionTimeoutMs: 1000,
      episodeTimeoutMs: 30000,
      runTimeoutMs: 120000,
    },
  });
  const deadline = Date.now() + 150000;
  while (["pending", "running"].includes(evaluation.status)) {
    assert.ok(Date.now() < deadline, "The bounded baseline did not finish.");
    await setTimeout(100);
    evaluation = await client.getEvaluation(evaluation.id);
  }
  assert.equal(evaluation.status, "completed");
  const recording = await client.exportEvaluation(evaluation.id);
  assert.equal(recording.episodes.length, 2);
  for (const episode of recording.episodes) {
    assert.equal(episode.outcome.kind, "terminated");
    const game = new ReversiGame();
    for (const decision of episode.decisions) {
      assert.deepEqual(game.observe(), decision.observation);
      const transition = game.step({ [decision.participantId]: decision.attemptedAction });
      assert.equal(transition.accepted, true);
      assert.deepEqual(transition.observations[decision.participantId], decision.nextObservation);
      assert.equal(decision.modelCalls.length, 0);
    }
    assert.deepEqual(episode.outcome, { kind: "terminated", ...game.getOutcome() });
  }
  await writeFile(
    join(output, "baseline-recording.json"),
    `${JSON.stringify(recording, null, 2)}\n`,
    { flag: "wx" },
  );
  report.checks.push(
    "complete baseline episodes replay through the pinned engine with zero inference",
  );
  let session = await client.createSession({ submissionId: "native-reversi-session", seed: 42 });
  const step = {
    submissionId: "native-reversi-step",
    expectedFrameIndex: 0,
    actions: { black: session.frame.requests.black.actionSpace.actions[0] },
  };
  session = await client.stepSession(session.id, step);
  assert.deepEqual(await client.stepSession(session.id, step), session);
  assert.equal(session.episode.decisions.length, 1);
  session = await client.closeSession(session.id, { submissionId: "native-reversi-close" });
  assert.equal(session.episode.outcome.kind, "cancelled");
  report.checks.push(
    "direct stepping records once for duplicate submissions and preserves cancellation",
  );
  const solution = await readFile(
    new URL("../harnesses/harbor/write-policy/solution/solve.sh", import.meta.url),
    "utf8",
  );
  const code = solution.split("<<'POLICY'\n")[1].split("\nPOLICY")[0];
  const verified = await verifyPolicy({ client, code });
  await writeFile(
    join(output, "policy-recording.json"),
    `${JSON.stringify(verified.recording, null, 2)}\n`,
    { flag: "wx" },
  );
  assert.equal(
    verified.passed,
    true,
    JSON.stringify({
      averageScore: verified.averageScore,
      episodes: verified.recording.episodes.map(({ trialId, outcome }) => ({ trialId, outcome })),
    }),
  );
  assert.equal(verified.recording.episodes.length, 8);
  report.averageScore = verified.averageScore;
  report.checks.push(
    "the Harbor verifier evaluates its frozen policy through the real restricted Worker",
  );
  if (values.python || values["pettingzoo-python"]) {
    const capability = new URLSearchParams(new URL(runtime.consoleUrl).hash.slice(1)).get(
      "capability",
    );
    assert.ok(capability);
    for (const [python, script, marker, check] of [
      [
        values.python,
        "openenv",
        /OpenEnv native session passed/,
        "OpenEnv native WebSocket stepping and retained close",
      ],
      [
        values["pettingzoo-python"],
        "pettingzoo",
        /PettingZoo native session passed/,
        "PettingZoo official AEC conformance and terminal-game trace",
      ],
    ]) {
      if (!python) continue;
      const result = await promisify(execFile)(
        resolve(python),
        [fileURLToPath(new URL(`../harnesses/${script}/qualify.py`, import.meta.url))],
        {
          timeout: 180000,
          env: {
            PATH: "/usr/bin:/bin",
            HOME: process.env.HOME,
            UNIVERSE_RUNTIME_ENDPOINT: runtime.origin,
            UNIVERSE_INSTALLATION_CAPABILITY: capability,
            GRADIO_ANALYTICS_ENABLED: "False",
            HF_HUB_OFFLINE: "1",
          },
        },
      );
      assert.match(result.stdout, marker);
      report.checks.push(check);
    }
  }
  await runtime.close();
  runtime = await launchEnvironment(options);
  assert.deepEqual(
    (await runtime.client.exportEvaluation(evaluation.id)).episodes,
    recording.episodes,
  );
  report.checks.push("the installation restarts without changing confirmed episodes");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = String(error.stack ?? error);
  throw error;
} finally {
  await runtime?.close();
  await writeFile(join(output, "results.json"), `${JSON.stringify(report, null, 2)}\n`, {
    flag: "wx",
  });
}
console.log(`Reversi native qualification passed: ${join(output, "results.json")}`);
