import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadRuntimeAsset,
  readRuntimeRelease,
  runtimeRelease,
} from "./runtime-release/index.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = readRuntimeRelease();
const names = runtime.manifest.packages.map((item) => item.archive);
names.push(
  `softmax_universe_client-${runtimeRelease.version.replace("-alpha.", "a")}-py3-none-any.whl`,
);
for (const name of names)
  downloadRuntimeAsset(runtime, name, join(root, ".local/runtime-packages", name));
console.log(`Verified ${names.length} private runtime dependencies for ${runtimeRelease.version}.`);
