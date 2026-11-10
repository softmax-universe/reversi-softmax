import type { Run, Episode } from "@softmax-universe/protocol";
import type { Player, ReversiGame } from "@softmax-universe/reversi-game";
import type { createRecorder } from "@softmax-universe/sdk";
export type Session = {
  run: Run;
  humanSeat: Player;
  game: ReversiGame;
  recorder: ReturnType<typeof createRecorder>;
  revision: number;
  finalEpisode: Episode | null;
};
