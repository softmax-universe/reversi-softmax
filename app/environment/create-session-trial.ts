import type { Json, Trial } from "@softmax-universe/protocol/game";
export function createSessionTrial(input: {
  seed: number;
  configuration?: Record<string, Json>;
}): Trial {
  if (input.configuration !== undefined && Object.keys(input.configuration).length !== 0) {
    throw new Error("Direct Reversi sessions do not accept configuration.");
  }
  return {
    id: "direct",
    seed: input.seed,
    participants: [
      { id: "black", label: "Black", kind: "human", policy: "direct" },
      { id: "white", label: "White", kind: "human", policy: "direct" },
    ],
  };
}
