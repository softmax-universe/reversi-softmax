import { assembleDistribution } from "@softmax-universe/local-cli";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { spec: { type: "string" }, output: { type: "string" }, archive: { type: "string" } },
});
if (!values.spec || !values.output) {
  throw new Error(
    "Usage: pnpm package:local --spec <checked runtime inputs.json> --output <new directory> [--archive <tar.gz>]",
  );
}
const inputFile = resolve(values.spec);
const spec = JSON.parse(await readFile(inputFile, "utf8"));
const workerPath = resolve("dist/worker/index.js");
const worker = await readFile(workerPath);
const environment = JSON.parse(await readFile("dist/environment.json", "utf8"));
const result = await assembleDistribution({
  inputDirectory: dirname(inputFile),
  outputDirectory: resolve(values.output),
  archivePath: values.archive === undefined ? undefined : resolve(values.archive),
  spec: {
    ...spec,
    environment,
    worker: {
      path: workerPath,
      sha256: createHash("sha256").update(worker).digest("hex"),
      compatibilityDate: "2026-11-09",
      compatibilityFlags: ["nodejs_compat"],
    },
    assetsDirectory: resolve("dist/console"),
    notices: [
      { source: resolve("LICENSE"), name: "reversi-softmax-LICENSE" },
      { source: resolve("THIRD_PARTY_NOTICES.md"), name: "reversi-softmax-NOTICES.md" },
    ],
    additionalFiles: [{ source: resolve("dist/harbor/verify.mjs"), path: "harbor/verify.mjs" }],
    commands: [{ name: "reversi-harbor-verify", entry: "harbor/verify.mjs" }],
  },
});
console.log(JSON.stringify(result));
