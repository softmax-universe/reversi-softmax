export type Player = "black" | "white";
export type Action = { row: number; column: number };
export type Observation = {
  board: (Player | null)[][];
  currentPlayer: Player;
  legalActions: Action[];
  pieceCounts: Record<Player, number>;
  ended: boolean;
};
