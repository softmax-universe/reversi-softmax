const board = document.querySelector("#board");
const status = document.querySelector("#status");
const error = document.querySelector("#error");
const form = document.querySelector("#start-form");
let game = null;
let busy = false;

function render() {
  const observation = game?.observation;
  const squares =
    observation?.board ??
    Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 8 }, (_, column) => {
        if ((row === 3 && column === 4) || (row === 4 && column === 3)) return "black";
        if ((row === 3 && column === 3) || (row === 4 && column === 4)) return "white";
        return null;
      }),
    );
  board.replaceChildren();
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const value = squares[row][column];
      const legal =
        observation?.legalActions.some(
          (action) => action.row === row && action.column === column,
        ) ?? false;
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `square${legal ? " legal" : ""}`;
      cell.setAttribute(
        "aria-label",
        `${String.fromCharCode(65 + column)}${row + 1}, ${value ?? (legal ? "legal move" : "empty")}`,
      );
      cell.disabled =
        busy || !legal || game?.humanSeat !== observation?.currentPlayer || game?.outcome !== null;
      if (value !== null) {
        const disc = document.createElement("span");
        disc.className = `disc ${value}`;
        cell.append(disc);
      }
      cell.addEventListener("click", () =>
        mutate("/api/move", { gameId: game.id, revision: game.revision, action: { row, column } }),
      );
      board.append(cell);
    }
  }
  document.querySelector("#black-count").textContent = observation?.pieceCounts.black ?? 2;
  document.querySelector("#white-count").textContent = observation?.pieceCounts.white ?? 2;
  document.querySelector("#start").disabled = busy;
  document.querySelector("#start").textContent = game ? "Start a new game" : "Start a game";
  document.querySelector("#download").hidden = game === null;
  if (game === null) return;
  if (game.outcome?.kind === "terminated") {
    const score = game.outcome.scores[game.humanSeat];
    status.textContent =
      score === 0.5
        ? "A draw. Well played."
        : score === 1
          ? "You win."
          : "The baseline wins. Try another seed.";
  } else if (game.outcome !== null) {
    status.textContent = `Game ${game.outcome.kind}. Start a new game to play again.`;
  } else {
    status.textContent = busy
      ? "Saving the move…"
      : `Your turn · ${game.humanSeat}. Choose a highlighted square.`;
  }
  document.querySelector("#recording-status").textContent =
    `${game.decisions} decisions saved${game.outcome === null ? " · game in progress" : ` · ${game.outcome.kind}`}.`;
}

async function mutate(path, body) {
  if (busy) return;
  busy = true;
  error.hidden = true;
  render();
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The request failed.");
    game = result.game;
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
    await refresh();
  } finally {
    busy = false;
    render();
    if (path === "/api/move") board.querySelector("button:not([disabled])")?.focus();
  }
}

async function refresh() {
  try {
    const response = await fetch("/api/game");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "The game is unavailable.");
    game = result.game;
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void mutate("/api/game", {
    humanSeat: document.querySelector("#seat").value,
    seed: Number(document.querySelector("#seed").value),
  });
});

await refresh();
render();
