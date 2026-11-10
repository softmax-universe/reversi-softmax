import { Schema } from "effect";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { jsonSchema } from "@softmax-universe/protocol";
import { HumanPlay, PlayError } from "./index.js";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "4318" },
    directory: { type: "string", default: ".local/play" },
  },
});
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("--port must be an integer from 1024 to 65535.");
}

const assets = new Map([
  [
    "/",
    {
      type: "text/html; charset=utf-8",
      content: await readFile(new URL("./public/index.html", import.meta.url)),
    },
  ],
  [
    "/app.js",
    {
      type: "text/javascript; charset=utf-8",
      content: await readFile(new URL("./public/app.js", import.meta.url)),
    },
  ],
  [
    "/style.css",
    {
      type: "text/css; charset=utf-8",
      content: await readFile(new URL("./public/style.css", import.meta.url)),
    },
  ],
]);
const recordingDirectory = resolve(process.env.INIT_CWD ?? process.cwd(), values.directory);
const play = new HumanPlay(recordingDirectory);
let ready = false;
let mutating = false;
let closing = false;
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

const server = createServer(
  { requestTimeout: 15_000, headersTimeout: 5_000 },
  (request, response) => {
    void handle(request, response).catch(() => {
      send(response, 500, {
        error: "The game could not save or process the request. Check the server terminal.",
      });
      console.error("A local game request failed. No request content was logged.");
    });
  },
);
server.maxConnections = 20;
server.maxRequestsPerSocket = 100;

async function handle(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  const host = request.headers.host;
  if (host === undefined || !hosts.has(host))
    return send(response, 403, { error: "Unsupported local host." });
  if (!ready || closing) return send(response, 503, { error: "The game is starting or stopping." });
  const path = new URL(request.url ?? "/", `http://${host}`).pathname;

  if (request.method === "GET") {
    const asset = assets.get(path);
    if (asset !== undefined) {
      response.writeHead(200, { "Content-Type": asset.type });
      response.end(asset.content);
      return;
    }
    if (path === "/api/game") return send(response, 200, { game: play.view() });
    if (path === "/api/recording") {
      try {
        response.setHeader("Content-Disposition", 'attachment; filename="reversi-recording.json"');
        return send(response, 200, play.recording());
      } catch (error) {
        if (error instanceof PlayError)
          return send(response, error.status, { error: error.message });
        throw error;
      }
    }
    return send(response, 404, { error: "Not found." });
  }

  if (request.method !== "POST" || !["/api/game", "/api/move"].includes(path)) {
    return send(response, 405, { error: "Method not allowed." });
  }
  if (request.headers.origin !== `http://${host}`)
    return send(response, 403, { error: "A same-origin request is required." });
  if (request.headers["content-type"] !== "application/json")
    return send(response, 415, { error: "Use application/json." });
  if (mutating) return send(response, 409, { error: "A move is still being saved. Try again." });

  mutating = true;
  try {
    const body = await readBody(request);
    if (path === "/api/game") {
      if (
        (body.humanSeat !== "black" && body.humanSeat !== "white") ||
        !Number.isSafeInteger(body.seed) ||
        typeof body.seed !== "number" ||
        body.seed < 0 ||
        body.seed > 4294967295
      ) {
        return send(response, 400, { error: "Choose a seat and a seed from 0 to 4294967295." });
      }
      return send(response, 200, { game: await play.start(body.humanSeat, body.seed) });
    }
    if (
      typeof body.gameId !== "string" ||
      !Number.isSafeInteger(body.revision) ||
      typeof body.revision !== "number"
    ) {
      return send(response, 400, { error: "The game and board revision are required." });
    }
    let action;
    try {
      action = Schema.decodeUnknownSync(jsonSchema, { onExcessProperty: "error" })(body.action);
    } catch {
      return send(response, 400, { error: "The action must be a JSON value." });
    }
    return send(response, 200, {
      game: await play.move({ gameId: body.gameId, revision: body.revision, action }),
    });
  } catch (error) {
    if (error instanceof PlayError) return send(response, error.status, { error: error.message });
    throw error;
  } finally {
    mutating = false;
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 4096) throw new PlayError(413, "The request is too large.");
    chunks.push(chunk);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new PlayError(400, "The request must contain JSON.");
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new PlayError(400, "The request must be an object.");
  }
  return body as Record<string, unknown>;
}

function send(response: ServerResponse, status: number, body: unknown) {
  if (response.writableEnded) return;
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolve);
});
try {
  await play.recover();
  ready = true;
  console.log(`Reversi: http://127.0.0.1:${port}`);
  console.log(`Recordings: ${recordingDirectory}`);
} catch (error) {
  server.close();
  throw error;
}

function stop() {
  if (closing) return;
  closing = true;
  server.close(() => {
    void play.close().catch(() => {
      console.error("The final checkpoint could not be saved. Preserve the recording directory.");
      process.exitCode = 1;
    });
  });
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
