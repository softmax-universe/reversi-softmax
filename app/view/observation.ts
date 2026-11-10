import type { Json } from "@softmax-universe/protocol/game";
import type { Action, Observation } from "@softmax-universe/reversi-game";

export function isAction(value: Json): value is Action {
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

export function isObservation(value: Json): value is Observation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const board = value.board;
  const counts = value.pieceCounts;
  return (
    Array.isArray(board) &&
    board.length === 8 &&
    board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 8 &&
        row.every((piece) => piece === null || piece === "black" || piece === "white"),
    ) &&
    (value.currentPlayer === "black" || value.currentPlayer === "white") &&
    Array.isArray(value.legalActions) &&
    value.legalActions.every(isAction) &&
    counts !== null &&
    typeof counts === "object" &&
    !Array.isArray(counts) &&
    typeof counts.black === "number" &&
    Number.isInteger(counts.black) &&
    counts.black >= 0 &&
    typeof counts.white === "number" &&
    Number.isInteger(counts.white) &&
    counts.white >= 0 &&
    typeof value.ended === "boolean"
  );
}
