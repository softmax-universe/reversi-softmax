import type { Json } from "@softmax-universe/protocol/game";
import type { Action } from "./types.js";
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
