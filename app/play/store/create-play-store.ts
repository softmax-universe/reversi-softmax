import { Schema } from "effect";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runSchema, episodeSchema, type Run, type Episode } from "@softmax-universe/protocol";
import { saveRun, saveEpisode } from "@softmax-universe/runner";
import { CHECKPOINT_FILE } from "./constants.js";
export function createPlayStore(directory: string) {
  const checkpointPath = join(directory, CHECKPOINT_FILE);
  const recordingDirectory = (runId: string) => join(directory, runId);
  return {
    recordingDirectory,
    async recoverCheckpoint() {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      let content: string;
      try {
        content = await readFile(checkpointPath, "utf8");
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
        throw error;
      }
      const checkpoint = JSON.parse(content) as { run: unknown; episode: unknown };
      const run = Schema.decodeUnknownSync(runSchema, { onExcessProperty: "error" })(
        checkpoint.run,
      );
      const episode = Schema.decodeUnknownSync(episodeSchema, { onExcessProperty: "error" })(
        checkpoint.episode,
      );
      await saveRun(recordingDirectory(run.id), run);
      await saveEpisode(recordingDirectory(run.id), run, episode);
      await rm(checkpointPath);
    },
    async createRun(run: Run) {
      await saveRun(recordingDirectory(run.id), run);
    },
    async saveCheckpoint(run: Run, episode: Episode) {
      await writeFile(checkpointPath + ".tmp", JSON.stringify({ run, episode }), {
        mode: 0o600,
        flush: true,
      });
      await rename(checkpointPath + ".tmp", checkpointPath);
      if (episode.outcome.kind !== "incomplete") {
        await saveEpisode(recordingDirectory(run.id), run, episode);
        await rm(checkpointPath);
      }
    },
  };
}
