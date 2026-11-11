import reversi from "reversi";
import { canonicalJson } from "@softmax-universe/protocol";
import { isAction, isObservation, type Observation } from "../validation/index.js";
import type {
  GameCheckpoint,
  GameFrame,
  GameSession,
  GameTransition,
  Json,
} from "@softmax-universe/protocol/game";

export class ReversiGame implements GameSession {
  private board = new reversi.Game().board;
  private actor: "BLACK" | "WHITE" = "BLACK";
  private tick = 0;
  private ended = false;

  observe(): Observation {
    const counts = this.board.countByPieceType();
    return {
      board: this.board.squares.map((row) =>
        row.map((square) =>
          square.pieceType === "BLACK" ? "black" : square.pieceType === "WHITE" ? "white" : null,
        ),
      ),
      currentPlayer: this.actor === "BLACK" ? "black" : "white",
      legalActions: this.ended
        ? []
        : this.board.getPlaceableSquares(this.actor).map((square) => ({
            row: square.rowIndex,
            column: square.colIndex,
          })),
      pieceCounts: { black: counts.BLACK, white: counts.WHITE },
      ended: this.ended,
    };
  }

  getFrame(): GameFrame | null {
    if (this.ended) return null;
    const observation = this.observe();
    return {
      tick: this.tick,
      requests: {
        [observation.currentPlayer]: {
          observation,
          actionSpace: { kind: "enumerated", actions: observation.legalActions },
        },
      },
    };
  }

  step(actions: Record<string, Json>): GameTransition {
    const participant = this.actor === "BLACK" ? "black" : "white";
    const action = actions[participant];
    if (
      this.ended ||
      Object.keys(actions).length !== 1 ||
      action === undefined ||
      !isAction(action) ||
      !this.board.isPlaceableSquare(action.row, action.column, this.actor)
    ) {
      return {
        accepted: false,
        tick: this.tick,
        actions: {},
        observations: this.observations(),
        rewards: { black: 0, white: 0 },
      };
    }
    this.board.placePiece(action.row, action.column, this.actor);
    this.tick += 1;
    const rival = this.actor === "BLACK" ? "WHITE" : "BLACK";
    if (this.board.hasPlacableSquare(rival)) this.actor = rival;
    else if (!this.board.hasPlacableSquare(this.actor)) {
      this.ended = true;
      this.actor = rival;
    }
    return {
      accepted: true,
      tick: this.tick,
      actions: { [participant]: { row: action.row, column: action.column } },
      observations: this.observations(),
      rewards: this.getOutcome()?.scores ?? { black: 0, white: 0 },
    };
  }

  getOutcome() {
    if (!this.ended) return null;
    const counts = this.board.countByPieceType();
    if (counts.BLACK === counts.WHITE) return { scores: { black: 0.5, white: 0.5 } };
    return {
      scores: {
        black: counts.BLACK > counts.WHITE ? 1 : 0,
        white: counts.WHITE > counts.BLACK ? 1 : 0,
      },
    };
  }

  snapshot(): GameCheckpoint {
    return { format: "reversi-board-v1", state: { observation: this.observe(), tick: this.tick } };
  }

  restore(checkpoint: GameCheckpoint): void {
    const state = checkpoint.state;
    if (
      checkpoint.format !== "reversi-board-v1" ||
      state === null ||
      typeof state !== "object" ||
      Array.isArray(state) ||
      typeof state.tick !== "number" ||
      !Number.isInteger(state.tick) ||
      state.tick < 0 ||
      state.tick > 60
    )
      throw new Error("Invalid Reversi checkpoint.");
    const observation = state.observation;
    if (observation === undefined || !isObservation(observation))
      throw new Error("Invalid Reversi checkpoint observation.");
    const board = new reversi.Board({
      mapText: observation.board
        .map((row) =>
          row.map((piece) => (piece === "black" ? "x" : piece === "white" ? "o" : "-")).join(""),
        )
        .join("\n"),
    });
    const actor = observation.currentPlayer === "black" ? "BLACK" : "WHITE";
    const counts = board.countByPieceType();
    const ended = !board.hasPlacableSquare("BLACK") && !board.hasPlacableSquare("WHITE");
    if (
      counts.BLACK + counts.WHITE !== state.tick + 4 ||
      ended !== observation.ended ||
      (!ended && !board.hasPlacableSquare(actor))
    )
      throw new Error("Inconsistent Reversi checkpoint.");
    const candidate = new ReversiGame();
    candidate.board = board;
    candidate.actor = actor;
    candidate.tick = state.tick;
    candidate.ended = ended;
    if (canonicalJson(candidate.observe()) !== canonicalJson(observation))
      throw new Error("Inconsistent Reversi observation.");
    this.board = candidate.board;
    this.actor = candidate.actor;
    this.tick = candidate.tick;
    this.ended = candidate.ended;
  }

  private observations(): Record<string, Json> {
    const observation = this.observe();
    return { black: structuredClone(observation), white: structuredClone(observation) };
  }
}
