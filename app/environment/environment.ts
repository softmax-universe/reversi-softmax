import type { EnvironmentDefinition } from "@softmax-universe/protocol/game";
import {
  baselineName,
  firstLegalBaseline,
  gameIdentity,
  ReversiGame,
  seededBaseline,
} from "@softmax-universe/reversi-game";
import { benchmarkTrials } from "../benchmarks/index.js";

export const environment: EnvironmentDefinition = {
  manifest: {
    id: "reversi-softmax",
    version: "0.3.0",
    game: gameIdentity,
    benchmarks: [
      {
        id: "balanced-seeded-v1",
        revision: "2",
        policySlots: [
          { id: "candidate", label: "Candidate", defaultPolicy: "first-legal" },
          { id: "reference", label: "Reference", defaultPolicy: baselineName },
        ],
        defaults: { pairs: 1 },
      },
    ],
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
      revision: "2",
      createTrials: benchmarkTrials,
    },
  },
};
