import type { Policy } from "@softmax-universe/protocol/game";
export const firstLegalBaseline: Policy = {
  definition: {
    kind: "baseline",
    revision: "first-legal-v1",
    configuration: {},
    recovery: "memory",
  },
  open() {
    return {
      decide(input) {
        if (input.actionSpace.kind !== "enumerated")
          throw new Error("Reversi requires enumerated actions.");
        const action = input.actionSpace.actions[0];
        if (action === undefined) throw new Error("No legal action is available.");
        return { action: structuredClone(action) };
      },
    };
  },
};
