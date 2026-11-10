import type { Participant, Trial } from "@softmax-universe/protocol";
import type { BenchmarkTrialOptions } from "@softmax-universe/protocol/game";
import { baselineName } from "@softmax-universe/reversi-game";
export function benchmarkTrials(options: BenchmarkTrialOptions): Trial[] {
  if (!Number.isSafeInteger(options.pairs) || options.pairs < 1 || options.pairs > 50) {
    throw new Error("A benchmark needs 1 to 50 balanced seed pairs.");
  }
  if (
    !Number.isSafeInteger(options.seed) ||
    options.seed < 0 ||
    options.seed > 4294967295 - options.pairs
  ) {
    throw new Error("The benchmark seed and pairs must fit in an unsigned 32-bit range.");
  }
  if (options.candidates.length === 0 || options.candidates.length > 8) {
    throw new Error("A benchmark needs 1 to 8 candidates.");
  }
  const ids = options.candidates.map((candidate) => candidate.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,47}$/.test(id))
  ) {
    throw new Error(
      "Candidate IDs must be distinct and contain 1 to 48 letters, digits, underscores, or hyphens.",
    );
  }
  const trials: Trial[] = [];
  for (const definition of options.candidates) {
    for (let pair = 0; pair < options.pairs; pair += 1) {
      for (const candidateSeat of ["black", "white"] as const) {
        const candidate: Participant = {
          id: candidateSeat,
          label: definition.label ?? definition.id,
          kind: "bot",
          policy: definition.policy,
        };
        if (definition.model !== undefined) candidate.model = definition.model;
        const reference: Participant = {
          id: candidateSeat === "black" ? "white" : "black",
          label: "Seeded baseline",
          kind: "bot",
          policy: baselineName,
        };
        trials.push({
          id: `candidate-${definition.id}_pair-${pair}_${candidateSeat}`,
          seed: options.seed + pair,
          participants: candidateSeat === "black" ? [candidate, reference] : [reference, candidate],
        });
      }
    }
  }
  return trials;
}
