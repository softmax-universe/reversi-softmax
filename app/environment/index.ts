import type { EnvironmentDefinition, Json, Trial } from "@softmax-universe/protocol/game";
import {
  baselineName,
  firstLegalBaseline,
  gameIdentity,
  ReversiGame,
  seededBaseline,
} from "@softmax-universe/reversi-game";
import { benchmarkTrials } from "../benchmarks/index.js";

export const reversiEnvironment: EnvironmentDefinition = {
  manifest: {
    id: "reversi-softmax",
    version: "0.1.0",
    game: gameIdentity,
    benchmarks: [{ id: "balanced-seeded-v1", revision: "1" }],
    requiredCapabilities: [],
  },
  createGame(_trial, signal) {
    signal.throwIfAborted();
    return new ReversiGame();
  },
  policies: { [baselineName]: seededBaseline, "first-legal": firstLegalBaseline },
  benchmarks: {
    "balanced-seeded-v1": {
      id: "balanced-seeded-v1",
      revision: "1",
      createTrials: benchmarkTrials,
    },
  },
};

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
