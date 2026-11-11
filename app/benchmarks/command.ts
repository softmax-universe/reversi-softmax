import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { jsonSchema, summarizeRun, type Run, type Policy } from "@softmax-universe/protocol";
import {
  readRunDirectory,
  runBenchmark,
  RunnerError,
  type RunLimits,
} from "@softmax-universe/runner";
import { createModelPolicy } from "@softmax-universe/model-policy";
import { createFoundationInference } from "@softmax-universe/foundation";
import { Schema } from "effect";
import { baselineName, firstLegalBaseline, seededBaseline } from "@softmax-universe/reversi-game";
import { gameIdentity, ReversiGame } from "@softmax-universe/reversi-game";
import { benchmarkTrials, type Candidate } from "./index.js";

class CommandError extends Error {}

async function main() {
  const { values } = parseArgs({
    options: {
      directory: { type: "string" },
      name: { type: "string" },
      pairs: { type: "string", default: "1" },
      seed: { type: "string", default: "42" },
      model: { type: "string", multiple: true, default: [] },
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
    console.log(`Usage: pnpm benchmark --directory <path> [--pairs 1] [--seed 42]
  [--model <Foundation model> ...]
  [--max-model-calls <count>] [--max-model-calls-per-decision 1]
  [--max-output-tokens 128] [--max-decisions 60]
  [--decision-timeout-ms 15000] [--episode-timeout-ms 600000] [--run-timeout-ms 1800000]

Without model options, compares first-legal-move against the seeded baseline in both seats.
Models require FOUNDATION_TOKEN and FOUNDATION_ENDPOINT (service origin).
Existing recordings in the same directory are skipped, including incomplete trials.`);
    return;
  }

  const pairs = integer("--pairs", values.pairs, 1, 50);
  const seed = integer("--seed", values.seed, 0, 4294967295 - pairs);
  const models = values.model;
  const allModels = models;
  if (
    allModels.length > 8 ||
    allModels.some((model) => model.length === 0 || model.length > 200) ||
    new Set(models).size !== models.length
  ) {
    throw new CommandError("Choose up to eight distinct model IDs, each at most 200 characters.");
  }
  if (allModels.length > 0 && values["max-model-calls"] === undefined) {
    throw new CommandError("Model runs require an explicit --max-model-calls budget.");
  }
  const limits = {
    maxDecisionsPerEpisode: integer("--max-decisions", values["max-decisions"], 1, 60),
    maxModelCalls: integer("--max-model-calls", values["max-model-calls"] ?? "0", 0, 10000),
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
  } satisfies RunLimits;
  const policies: Record<string, Policy> = { [baselineName]: seededBaseline };
  const candidates: Candidate[] = [];
  if (allModels.length === 0) {
    policies["first-legal"] = firstLegalBaseline;
    candidates.push({ id: "0", policy: "first-legal", label: "First legal move" });
  }
  if (models.length > 0) {
    const token = requiredEnvironment("FOUNDATION_TOKEN");
    const endpoint = requiredEnvironment("FOUNDATION_ENDPOINT");
    for (const [index, model] of models.entries()) {
      const policy = `model-${index}`;
      policies[policy] = createModelPolicy({
        model,
        inference: createFoundationInference({ token, endpoint }),
      });
      candidates.push({ id: String(candidates.length), policy, label: model, model });
    }
  }
  const configuration = {
    reference: baselineName,
    candidates: candidates.map((candidate) => candidate.policy),
    pairs,
    seed,
    runnerLimits: limits,
    policies: Object.fromEntries(
      Object.entries(policies).map(([name, policy]) => [
        name,
        Schema.decodeUnknownSync(jsonSchema, { onExcessProperty: "error" })(policy.definition),
      ]),
    ),
  };
  const id = `benchmark-${randomUUID()}`;
  const directory = resolve(
    process.env.INIT_CWD ?? process.cwd(),
    values.directory ?? join(".local", "benchmarks", id),
  );
  let run: Run = {
    schemaVersion: 3,
    id,
    name:
      values.name ??
      (allModels.length > 0
        ? "Policies vs seeded baseline"
        : "First legal move vs seeded baseline"),
    createdAt: new Date().toISOString(),
    kind: "benchmark",
    game: gameIdentity,
    configuration,
    trials: candidates.flatMap((candidate) =>
      benchmarkTrials({
        seed,
        configuration: { pairs },
        bindings: {
          candidate,
          reference: { id: "reference", policy: baselineName, label: "Seeded baseline" },
        },
      }),
    ),
  };
  if (existsSync(join(directory, "run.json"))) {
    const saved = await readRunDirectory(directory);
    if (
      !isDeepStrictEqual(saved.run.configuration, configuration) ||
      !isDeepStrictEqual(saved.run.game, gameIdentity) ||
      (values.name !== undefined && values.name !== saved.run.name)
    ) {
      throw new CommandError(
        "This directory belongs to a different configuration. Choose a new directory.",
      );
    }
    run = saved.run;
  }

  console.log(`Run: ${run.id}`);
  console.log(`Directory: ${directory}`);
  const result = await runBenchmark({
    run,
    createGame: () => new ReversiGame(),
    policies,
    directory,
    limits,
  });
  console.table(
    summarizeRun(result.run, result.episodes).map((row) => ({
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
      toolCalls: row.toolCalls,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: row.costUsd,
    })),
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new CommandError(`Set ${name} for this policy.`);
  return value;
}

function integer(name: string, value: string, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new CommandError(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

main().catch((error: unknown) => {
  if (error instanceof CommandError || error instanceof RunnerError) {
    console.error(error.message);
  } else {
    console.error(
      "The benchmark could not start. Check the command, package versions, and recording directory.",
    );
  }
  process.exitCode = 1;
});
