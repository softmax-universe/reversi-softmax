import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { isDeepStrictEqual } from "node:util";
import type { RuntimeClient } from "@softmax-universe/runtime-client";
import type { RunExport } from "@softmax-universe/protocol/recordings";
import { baselineName } from "@softmax-universe/reversi-game";
import { reversiEnvironment } from "../environment/index.js";

export interface PolicyVerification {
  passed: boolean;
  averageScore: number | null;
  policyHash: string;
  evaluationId: string;
  recording: RunExport;
}

export async function verifyPolicy(options: {
  client: RuntimeClient;
  code: string;
  signal?: AbortSignal;
}): Promise<PolicyVerification> {
  const { client, signal } = options;
  const runtime = await client.getEnvironment({ signal });
  if (!isDeepStrictEqual(runtime.manifest, reversiEnvironment.manifest)) {
    throw new Error("The verifier requires the matching Reversi environment release.");
  }
  const identity = createHash("sha256")
    .update(
      JSON.stringify({
        code: options.code,
        manifest: reversiEnvironment.manifest,
        seed: 42,
        pairs: 4,
      }),
    )
    .digest("hex");
  const artifact = await client.createPolicyArtifact(
    { submissionId: `policy-${identity}`, code: options.code },
    { signal },
  );
  const experiment = await client.createExperiment(
    {
      submissionId: `experiment-${identity}`,
      name: "Harbor policy verification",
      budget: { maxModelCalls: 0 },
    },
    { signal },
  );
  let evaluation = await client.submitEvaluation(
    {
      submissionId: `evaluation-${identity}`,
      experimentId: experiment.id,
      benchmarkId: "balanced-seeded-v1",
      policy: { kind: "artifact", hash: artifact.hash },
      seed: 42,
      pairs: 4,
      limits: {
        maxDecisionsPerEpisode: 60,
        maxModelCalls: 0,
        maxModelCallsPerDecision: 1,
        maxOutputTokens: 64,
        decisionTimeoutMs: 1_000,
        episodeTimeoutMs: 15_000,
        runTimeoutMs: 120_000,
      },
    },
    { signal },
  );
  const deadline = Date.now() + 150_000;
  while (evaluation.status === "pending" || evaluation.status === "running") {
    if (Date.now() >= deadline) {
      evaluation = await client.cancelEvaluation(
        evaluation.id,
        { submissionId: `cancel-${identity}` },
        { signal },
      );
      break;
    }
    await setTimeout(100, undefined, { signal });
    evaluation = await client.getEvaluation(evaluation.id, { signal });
  }
  const recording = await client.exportEvaluation(evaluation.id, { signal });
  let score = 0;
  let completed =
    evaluation.status === "completed" &&
    recording.episodes.length === 8 &&
    recording.run.trials.length === 8;
  for (const trial of recording.run.trials) {
    const candidate = trial.participants.find((participant) => participant.policy !== baselineName);
    const episode = recording.episodes.find((item) => item.trialId === trial.id);
    if (candidate === undefined || episode?.outcome.kind !== "terminated") {
      completed = false;
      continue;
    }
    const value = episode.outcome.scores[candidate.id];
    if (value === undefined || !Number.isFinite(value)) {
      completed = false;
      continue;
    }
    score += value;
  }
  const averageScore = completed ? score / recording.run.trials.length : null;
  return {
    passed: averageScore !== null && averageScore >= 0.5,
    averageScore,
    policyHash: artifact.hash,
    evaluationId: evaluation.id,
    recording,
  };
}
