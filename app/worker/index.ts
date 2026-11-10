import { createRuntimeObject, createRuntimeWorker } from "@softmax-universe/runtime";
import assets from "reversi:assets";
import { createSessionTrial, reversiEnvironment } from "../environment/index.js";

export class UniverseRuntime extends createRuntimeObject({
  environment: reversiEnvironment,
  createSessionTrial,
}) {}

const runtime = createRuntimeWorker();

export default {
  async fetch(request: Request, env: Parameters<typeof runtime.fetch>[1]) {
    if (request.method === "GET") {
      const asset = assets.get(new URL(request.url).pathname);
      if (asset !== undefined) {
        return new Response(asset.content, {
          headers: {
            "Content-Type": asset.type,
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'self'; frame-ancestors 'none'; base-uri 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
          },
        });
      }
    }
    return runtime.fetch(request, env);
  },
};
