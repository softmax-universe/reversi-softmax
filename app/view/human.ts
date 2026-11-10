import { Schema } from "effect";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  episodeSchema,
  runSchema,
  type Episode,
  type Json,
  type Run,
} from "@softmax-universe/protocol";
import { createRecorder } from "@softmax-universe/sdk";
import { saveEpisode, saveRun } from "@softmax-universe/runner";
import { baselineAction } from "@softmax-universe/reversi-game";
import { ReversiGame, type Player } from "@softmax-universe/reversi-game";
import { humanRun } from "../benchmarks/index.js";

const maxDecisions = 128;

type Session = {
  run: Run;
  humanSeat: Player;
  game: ReversiGame;
  recorder: ReturnType<typeof createRecorder>;
  revision: number;
  finalEpisode: Episode | null;
};

export class PlayError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class HumanPlay {
  private session: Session | null = null;
  private storageFailed = false;

  constructor(private readonly directory: string) {}

  async recover() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    let content: string;
    try {
      content = await readFile(join(this.directory, "active.json"), "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
    const checkpoint = JSON.parse(content) as { run: unknown; episode: unknown };
    const run = Schema.decodeUnknownSync(runSchema, { onExcessProperty: "error" })(checkpoint.run);
    const episode = Schema.decodeUnknownSync(episodeSchema, { onExcessProperty: "error" })(
      checkpoint.episode,
    );
    const directory = join(this.directory, run.id);
    await saveRun(directory, run);
    await saveEpisode(directory, run, episode);
    await rm(join(this.directory, "active.json"));
  }

  view() {
    const session = this.session;
    if (session === null) return null;
    return {
      id: session.run.id,
      revision: session.revision,
      humanSeat: session.humanSeat,
      seed: session.run.trials[0]!.seed,
      observation: session.game.observe(),
      outcome: session.finalEpisode?.outcome ?? null,
      decisions: session.recorder.snapshot().decisions.length,
      recordingDirectory: join(this.directory, session.run.id),
    };
  }

  async start(humanSeat: Player, seed: number) {
    this.requireStorage();
    await this.close("A new game was started.");
    const run = humanRun({ id: `play-${randomUUID()}`, humanSeat, seed });
    const recorder = createRecorder({ run, trialId: "game", episodeId: randomUUID() });
    this.session = {
      run,
      humanSeat,
      game: new ReversiGame(),
      recorder,
      revision: 0,
      finalEpisode: null,
    };
    await saveRun(join(this.directory, run.id), run);
    await this.checkpoint();
    await this.playBaselineTurns();
    return this.view();
  }

  async move(input: { gameId: string; revision: number; action: Json }) {
    this.requireStorage();
    const session = this.session;
    if (session === null) throw new PlayError(409, "Start a game first.");
    if (input.gameId !== session.run.id || input.revision !== session.revision) {
      throw new PlayError(409, "The board changed. Refresh the game and choose a move.");
    }
    if (session.finalEpisode !== null) throw new PlayError(409, "This game has finished.");
    if (session.game.getTurn()?.participantId !== session.humanSeat) {
      throw new PlayError(409, "It is the baseline’s turn.");
    }
    const accepted = await this.recordAction(input.action);
    if (!accepted) throw new PlayError(422, "That move is not legal.");
    await this.playBaselineTurns();
    return this.view();
  }

  recording() {
    if (this.session === null) throw new PlayError(404, "No game has been started.");
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      run: this.session.run,
      episodes: [this.session.recorder.snapshot()],
    };
  }

  async close(reason = "The local server stopped.") {
    const session = this.session;
    if (session === null || session.finalEpisode !== null) return;
    session.finalEpisode = session.recorder.finish({ kind: "cancelled", reason });
    await this.checkpoint();
  }

  private async playBaselineTurns() {
    const session = this.session;
    if (session === null) return;
    let turn = session.game.getTurn();
    while (
      turn !== null &&
      turn.participantId !== session.humanSeat &&
      session.finalEpisode === null
    ) {
      const action = baselineAction({
        seed: session.run.trials[0]!.seed,
        participantId: turn.participantId,
        observation: turn.observation,
        legalActions: turn.legalActions,
      });
      const accepted = await this.recordAction(action);
      if (!accepted) throw new Error("The baseline produced an illegal move.");
      turn = session.game.getTurn();
    }
  }

  private async recordAction(action: Json) {
    const session = this.session;
    if (session === null) throw new Error("No active game.");
    const turn = session.game.getTurn();
    if (turn === null) throw new Error("The game has ended.");
    if (session.recorder.snapshot().decisions.length >= maxDecisions) {
      session.finalEpisode = session.recorder.finish({
        kind: "failed",
        code: "decision_limit",
        message: "The local game exceeded its decision limit.",
      });
      await this.checkpoint();
      throw new PlayError(409, "This game reached its decision limit. Start a new game.");
    }

    const result = session.game.apply(action);
    session.recorder.recordDecision({
      participantId: turn.participantId,
      observation: turn.observation,
      attemptedAction: action,
      acceptedAction: result.action,
      nextObservation: result.nextObservation,
      status: result.accepted ? "accepted" : "rejected",
    });
    session.revision += 1;
    const outcome = session.game.getOutcome();
    if (outcome !== null) {
      session.finalEpisode = session.recorder.finish({
        kind: "terminated",
        scores: outcome.scores,
      });
    }
    await this.checkpoint();
    return result.accepted;
  }

  private async checkpoint() {
    const session = this.session;
    if (session === null) return;
    const checkpointPath = join(this.directory, "active.json");
    const episode = session.recorder.snapshot();
    try {
      await writeFile(`${checkpointPath}.tmp`, JSON.stringify({ run: session.run, episode }), {
        mode: 0o600,
        flush: true,
      });
      await rename(`${checkpointPath}.tmp`, checkpointPath);
      if (session.finalEpisode !== null) {
        await saveEpisode(join(this.directory, session.run.id), session.run, episode);
        await rm(checkpointPath);
      }
    } catch (error) {
      this.storageFailed = true;
      throw error;
    }
  }

  private requireStorage() {
    if (this.storageFailed) {
      throw new PlayError(
        503,
        "Recording storage failed. Preserve the directory and restart the server after fixing storage.",
      );
    }
  }
}
