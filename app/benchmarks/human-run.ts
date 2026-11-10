import type { Participant, Run } from "@softmax-universe/protocol";
import { baselineName, gameIdentity, type Player } from "@softmax-universe/reversi-game";
export function humanRun(options: { id: string; humanSeat: Player; seed: number }): Run {
  const participants: Participant[] = (["black", "white"] as const).map((seat) => {
    if (seat === options.humanSeat) {
      return { id: seat, label: "You", kind: "human", policy: "human" };
    }
    return { id: seat, label: "Seeded baseline", kind: "bot", policy: baselineName };
  });
  return {
    schemaVersion: 2,
    id: options.id,
    name: "Human vs seeded baseline",
    kind: "play",
    createdAt: new Date().toISOString(),
    game: gameIdentity,
    configuration: { baseline: baselineName, humanSeat: options.humanSeat },
    trials: [{ id: "game", seed: options.seed, participants }],
  };
}
