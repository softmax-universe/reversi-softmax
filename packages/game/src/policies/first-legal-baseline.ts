import type { Policy } from "@softmax-universe/protocol/game";
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
