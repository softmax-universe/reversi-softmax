import reversi from "reversi";
import type { Json, GameSession } from "@softmax-universe/protocol/game";

export const gameIdentity = { id: "reversi", version: "reversi-3.0.0_adapter-1" };
export type Player = "black" | "white";
export type Action = { row: number; column: number };
export type Observation = {
  board: (Player | null)[][];
  currentPlayer: Player;
  legalActions: Action[];
  pieceCounts: Record<Player, number>;
  ended: boolean;
};

export class ReversiGame implements GameSession {
  private readonly engine = new reversi.Game();
  private actor: "BLACK" | "WHITE" = "BLACK";

  observe(): Observation {
    const counts = this.engine.board.countByPieceType();
    const legalActions = this.engine.isEnded
      ? []
      : this.engine.board.getPlaceableSquares(this.actor).map((square) => ({
          row: square.rowIndex,
          column: square.colIndex,
        }));

    return {
      board: this.engine.board.squares.map((row) =>
        row.map((square) => {
          if (square.pieceType === "BLACK") return "black";
          if (square.pieceType === "WHITE") return "white";
          return null;
        }),
      ),
      currentPlayer: this.actor === "BLACK" ? "black" : "white",
      legalActions,
      pieceCounts: { black: counts.BLACK, white: counts.WHITE },
      ended: this.engine.isEnded,
    };
  }

  getTurn() {
    if (this.engine.isEnded) return null;
    const observation = this.observe();
    return {
      participantId: observation.currentPlayer,
      observation,
      legalActions: observation.legalActions,
    };
  }

  apply(action: Json) {
    if (this.engine.isEnded || !isAction(action)) {
      return { accepted: false, action: null, nextObservation: this.observe() };
    }

    const report = this.engine.proceed(action.row, action.column);
    if (!report.isSuccess) {
      return { accepted: false, action: null, nextObservation: this.observe() };
    }

    // The engine passes a player with no legal move inside proceed().
    this.actor = report.isNextActorPassed ? report.pieceType : report.rivalPieceType;
    return {
      accepted: true,
      action: { row: action.row, column: action.column },
      nextObservation: this.observe(),
    };
  }

  getOutcome() {
    if (!this.engine.isEnded) return null;
    const winner = this.engine.getHighScorer();
    if (winner === null) return { scores: { black: 0.5, white: 0.5 } };
    return { scores: { black: winner === "BLACK" ? 1 : 0, white: winner === "WHITE" ? 1 : 0 } };
  }
}

function isAction(value: Json): value is Action {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    Object.keys(value).length === 2 &&
    typeof value.row === "number" &&
    Number.isInteger(value.row) &&
    value.row >= 0 &&
    value.row < 8 &&
    typeof value.column === "number" &&
    Number.isInteger(value.column) &&
    value.column >= 0 &&
    value.column < 8
  );
}
