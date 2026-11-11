import type { Participant, Trial } from "@softmax-universe/protocol";
import type { BenchmarkTrialOptions } from "@softmax-universe/protocol/game";

export function benchmarkTrials(options: BenchmarkTrialOptions): Trial[] {
  const pairs = options.configuration.pairs ?? 1;
  if (
    typeof pairs !== "number" ||
    !Number.isSafeInteger(pairs) ||
    pairs < 1 ||
    pairs > 50 ||
    Object.keys(options.configuration).some((key) => key !== "pairs")
  )
    throw new Error("Choose 1 to 50 balanced pairs.");
  if (!Number.isSafeInteger(options.seed) || options.seed < 0 || options.seed > 4294967295 - pairs)
    throw new Error("The seed and pairs must fit in an unsigned 32-bit range.");
  const candidate = options.bindings.candidate;
  const reference = options.bindings.reference;
  if (!candidate || !reference || Object.keys(options.bindings).length !== 2)
    throw new Error("Choose a candidate and a reference policy.");
  const trials: Trial[] = [];
  for (let pair = 0; pair < pairs; pair += 1) {
    for (const candidateSeat of ["black", "white"] as const) {
      const participant = (seat: string, definition: typeof candidate): Participant => ({
        id: seat,
        label: definition.label ?? definition.id,
        kind: "bot",
        policy: definition.policy,
        ...(definition.model ? { model: definition.model } : {}),
      });
      const other = candidateSeat === "black" ? "white" : "black";
      const chosen = participant(candidateSeat, candidate);
      const opponent = participant(other, reference);
      trials.push({
        id: "candidate-" + candidate.id + "_pair-" + pair + "_" + candidateSeat,
        seed: options.seed + pair,
        participants: candidateSeat === "black" ? [chosen, opponent] : [opponent, chosen],
      });
    }
  }
  return trials;
}
