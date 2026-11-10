import type { Json, Policy } from "@softmax-universe/protocol/game";

export const baselineName = "seeded-uniform-v1";

export function baselineAction(input: {
  seed: number;
  participantId: string;
  observation: Json;
  legalActions: Json[];
}): Json {
  if (input.legalActions.length === 0) throw new Error("No legal action is available.");
  const key = JSON.stringify([input.seed, input.participantId, input.observation]);
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  const action = input.legalActions[(hash >>> 0) % input.legalActions.length];
  if (action === undefined) throw new Error("The legal action list is empty.");
  return structuredClone(action);
}

export const seededBaseline: Policy = {
  definition: { kind: "baseline", revision: "seeded-uniform-v1", configuration: {} },
  open() {
    return {
      decide(input) {
        return {
          action: baselineAction({
            seed: input.trial.seed,
            participantId: input.participantId,
            observation: input.observation,
            legalActions: input.legalActions,
          }),
        };
      },
    };
  },
};

export const firstLegalBaseline: Policy = {
  definition: { kind: "baseline", revision: "first-legal-v1", configuration: {} },
  open() {
    return {
      decide(input) {
        const action = input.legalActions[0];
        if (action === undefined) throw new Error("No legal action is available.");
        return { action: structuredClone(action) };
      },
    };
  },
};
