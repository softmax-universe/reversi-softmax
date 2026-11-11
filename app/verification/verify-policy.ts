import { createHash } from "node:crypto";
import { RuntimeApiError } from "@softmax-universe/runtime-client";
import { isDeepStrictEqual } from "node:util";
import type { RuntimeClient } from "@softmax-universe/runtime-client";
import { baselineName } from "@softmax-universe/reversi-game";
import { environment } from "../environment/index.js";

import type { PolicyVerification } from "./types.js";
export async function verifyPolicy(options: {
  client: RuntimeClient;
  code: string;
  signal?: AbortSignal;
}): Promise<PolicyVerification> {
  const { client, signal } = options;
  const runtime = await client.getEnvironment({ signal });
  if (!isDeepStrictEqual(runtime.manifest, environment.manifest)) {
    throw new Error("The verifier requires the matching Reversi environment release.");
  }
  const identity = createHash("sha256")
    .update(
      JSON.stringify({
        code: options.code,
        manifest: environment.manifest,
        seed: 42,
        pairs: 4,
      }),
    )
    .digest("hex");
  const artifact = await client.createPolicyArtifact(
    { submissionId: `policy-${identity}`, code: options.code },
    { signal },
  );
  let evaluation = await client.evaluations.start(
    {
      submissionId: `evaluation-${identity}`,
      name: "Harbor policy verification",
      benchmarkId: "balanced-seeded-v1",
      policies: {
        candidate: { kind: "artifact", hash: artifact.hash },
        reference: { kind: "baseline", policyId: baselineName },
      },
      seed: 42,
      configuration: { pairs: 4 },
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
  try {
    evaluation = await client.evaluations.wait(evaluation.id, {
      deadlineAt: Date.now() + 150_000,
      signal,
    });
  } catch (error) {
    if (!(error instanceof RuntimeApiError) || error.code !== "deadline_exceeded") throw error;
    evaluation = await client.evaluations.cancel(
      evaluation.id,
      { submissionId: `cancel-${identity}` },
      { signal },
    );
  }
  const recording = await client.evaluations.export(evaluation.id, { signal });
  let score = 0;
  let completed =
    evaluation.status === "completed" &&
    recording.episodes.length === 8 &&
    recording.run.trials.length === 8;
  for (const trial of recording.run.trials) {
    const candidate = trial.participants.find(
      (participant) => participant.policy === evaluation.manifest.policies.candidate!.policyKey,
    );
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
