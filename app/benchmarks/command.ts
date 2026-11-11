import { randomUUID, createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { isDeepStrictEqual } from "node:util";
import {
  launchEnvironment,
  connectInstallation,
  type LocalEnvironment,
} from "@softmax-universe/installation";
import { createRuntimeClient, type RuntimeClient } from "@softmax-universe/runtime-client";
import { summarizeRun } from "@softmax-universe/protocol";
import type { EvaluationPolicy } from "@softmax-universe/protocol/control";
import { baselineName } from "@softmax-universe/reversi-game";
import { environment } from "../environment/index.js";

async function main() {
  const { values } = parseArgs({
    options: {
      state: { type: "string" },
      release: { type: "string" },
      port: { type: "string", default: "4328" },
      models: { type: "string" },
      name: { type: "string", default: "Policies vs seeded baseline" },
      pairs: { type: "string", default: "1" },
      seed: { type: "string", default: "42" },
      model: { type: "string", multiple: true, default: [] },
      "submission-id": { type: "string" },
      "max-model-calls": { type: "string" },
      "max-model-calls-per-decision": { type: "string", default: "1" },
      "max-output-tokens": { type: "string", default: "128" },
      "max-decisions": { type: "string", default: "60" },
      "decision-timeout-ms": { type: "string", default: "15000" },
      "episode-timeout-ms": { type: "string", default: "600000" },
      "run-timeout-ms": { type: "string", default: "1800000" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(`Usage: pnpm benchmark --state <installation> [--pairs 1] [--seed 42]
  [--release <release.json> --port 4328 --models <private.json>]
  [--model <configured-model-id> ...] [--submission-id <stable-id>]
  [--max-model-calls <total>] [--max-model-calls-per-decision 1]
  [--max-output-tokens 128] [--max-decisions 60]
  [--decision-timeout-ms 15000] [--episode-timeout-ms 600000] [--run-timeout-ms 1800000]

Connects to the local installation. With --release, starts it for this command.
Without --model, compares first-legal against the seeded baseline in both seats.
Model IDs come from the installation's explicit private model configuration.
The total model-call budget is divided evenly across candidates.
Repeat the same --submission-id and inputs to reattach to existing evaluations.
Recordings stay in the installation and can be inspected or exported with universe-local.`);
    return;
  }
  if (!values.state) throw new Error("--state is required.");
  if (!values.release && values.models) throw new Error("--models requires --release.");
  const pairs = integer("--pairs", values.pairs, 1, 50);
  const seed = integer("--seed", values.seed, 0, 4294967295 - pairs);
  const modelIds = values.model;
  if (modelIds.length > 8 || new Set(modelIds).size !== modelIds.length)
    throw new Error("Choose up to eight distinct configured model IDs.");
  if (modelIds.length > 0 && values["max-model-calls"] === undefined)
    throw new Error("Model evaluations require an explicit --max-model-calls budget.");
  const maxModelCalls = integer("--max-model-calls", values["max-model-calls"] ?? "0", 0, 10000);
  const limits = {
    maxDecisionsPerEpisode: integer("--max-decisions", values["max-decisions"], 1, 60),
    maxModelCalls,
    maxModelCallsPerDecision: integer(
      "--max-model-calls-per-decision",
      values["max-model-calls-per-decision"],
      1,
      100,
    ),
    maxOutputTokens: integer("--max-output-tokens", values["max-output-tokens"], 1, 4096),
    decisionTimeoutMs: integer("--decision-timeout-ms", values["decision-timeout-ms"], 100, 120000),
    episodeTimeoutMs: integer("--episode-timeout-ms", values["episode-timeout-ms"], 100, 3600000),
    runTimeoutMs: integer("--run-timeout-ms", values["run-timeout-ms"], 100, 7200000),
  };
  const submissionId = values["submission-id"] ?? randomUUID();
  console.log(`Submission: ${submissionId}`);
  const observation = new AbortController();
  const interrupt = () => observation.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  let owned: LocalEnvironment | undefined;
  try {
    let client: RuntimeClient;
    if (values.release) {
      owned = await launchEnvironment({
        releaseManifest: resolve(values.release),
        stateDirectory: resolve(values.state),
        port: integer("--port", values.port, 1, 65535),
        modelsFile: values.models ? resolve(values.models) : undefined,
        signal: observation.signal,
      });
      client = owned.client;
    } else {
      const installation = await connectInstallation(resolve(values.state));
      client = createRuntimeClient({
        endpoint: installation.origin,
        token: installation.capability,
      });
    }
    const runtime = await client.getEnvironment({ signal: observation.signal });
    if (!isDeepStrictEqual(runtime.manifest, environment.manifest))
      throw new Error("Use the matching Reversi environment release.");
    for (const modelId of modelIds) {
      if (!runtime.models.includes(modelId))
        throw new Error(`Model ${modelId} is not configured in this installation.`);
    }
    const candidates: EvaluationPolicy[] = modelIds.length
      ? modelIds.map((modelId) => ({ kind: "model", modelId }))
      : [{ kind: "baseline", policyId: "first-legal" }];
    const experiment = await client.createExperiment(
      {
        submissionId,
        name: values.name,
        budget: { maxModelCalls },
      },
      { signal: observation.signal },
    );

    for (const [index, candidate] of candidates.entries()) {
      const allowance =
        Math.floor(maxModelCalls / candidates.length) +
        Number(index < maxModelCalls % candidates.length);
      const evaluation = await client.evaluations.submit(
        {
          submissionId: createHash("sha256")
            .update(JSON.stringify([submissionId, index]))
            .digest("hex"),
          experimentId: experiment.id,
          benchmarkId: "balanced-seeded-v1",
          policies: {
            candidate,
            reference: { kind: "baseline", policyId: baselineName },
          },
          seed,
          configuration: { pairs },
          limits: { ...limits, maxModelCalls: allowance },
        },
        { signal: observation.signal },
      );
      console.log(`Evaluation: ${evaluation.id} (model-call limit ${allowance})`);
      const result = await client.evaluations.wait(evaluation.id, {
        deadlineAt: Date.now() + limits.runTimeoutMs + 30000,
        signal: observation.signal,
      });
      const recording = await client.evaluations.export(result.id, { signal: observation.signal });
      console.table(
        summarizeRun(recording.run, recording.episodes).map((row) => ({
          policy: row.participantLabels.join(", "),
          planned: row.planned,
          completed: row.completed,
          failed: row.failed,
          truncated: row.truncated,
          cancelled: row.cancelled,
          incomplete: row.incomplete,
          missing: row.missing,
          averageScore: row.averageScore,
          modelCalls: row.modelCalls,
          reservedModelCalls: row.reservedModelCalls,
        })),
      );
      if (
        result.status !== "completed" ||
        recording.episodes.some((episode) => episode.outcome.kind !== "terminated")
      )
        process.exitCode = 1;
    }
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    await owned?.close();
  }
}

function integer(name: string, value: string, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum)
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "The benchmark could not finish.");
  process.exitCode = 1;
});
