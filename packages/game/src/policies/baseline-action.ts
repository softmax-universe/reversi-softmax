import type { Json } from "@softmax-universe/protocol/game";
import { canonicalJson } from "@softmax-universe/protocol";
export function baselineAction(input: {
  seed: number;
  participantId: string;
  observation: Json;
  legalActions: Json[];
}): Json {
  if (input.legalActions.length === 0) throw new Error("No legal action is available.");
  const key = canonicalJson([input.seed, input.participantId, input.observation]);
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  }
  const action = input.legalActions[(hash >>> 0) % input.legalActions.length];
  if (action === undefined) throw new Error("The legal action list is empty.");
  return structuredClone(action);
}
