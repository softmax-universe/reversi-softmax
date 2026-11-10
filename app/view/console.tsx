import { mountConsole } from "@softmax-universe/console";
import type { ActionFormatter, ObservationRenderer } from "@softmax-universe/inspector";
import { isAction, isObservation } from "@softmax-universe/reversi-game/validation";
import "@softmax-universe/console/styles.css";
import "./console.css";

const renderObservation: ObservationRenderer = ({ game, observation, acceptedAction }) => {
  if (game.id !== "reversi" || !isObservation(observation)) return null;
  const action = isAction(acceptedAction) ? acceptedAction : null;
  return (
    <figure className="reversi-position">
      <div className="reversi-board" role="img" aria-label="Reversi board. Black and white pieces.">
        {observation.board.flatMap((row, rowIndex) =>
          row.map((piece, columnIndex) => (
            <span
              className={`reversi-square ${action?.row === rowIndex && action?.column === columnIndex ? "last-move" : ""}`}
              key={`${rowIndex}-${columnIndex}`}
              title={`${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}: ${piece ?? "empty"}`}
            >
              {piece === null ? null : <i className={`reversi-piece ${piece}`} />}
            </span>
          )),
        )}
      </div>
      <figcaption>
        Black {observation.pieceCounts.black} · White {observation.pieceCounts.white}
        {observation.ended ? " · Game ended" : ` · ${observation.currentPlayer} to move`}
      </figcaption>
    </figure>
  );
};

const formatAction: ActionFormatter = (value, game) => {
  if (game.id !== "reversi" || !isAction(value)) return null;
  return `${String.fromCharCode(65 + value.column)}${value.row + 1}`;
};

const element = document.querySelector<HTMLElement>("#app");
if (element === null) throw new Error("The application element is missing.");
mountConsole({ element, endpoint: window.location.origin, renderObservation, formatAction });
