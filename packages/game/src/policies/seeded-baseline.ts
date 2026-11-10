import type { Policy } from "@softmax-universe/protocol/game";
import { baselineAction } from "./baseline-action.js";
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
