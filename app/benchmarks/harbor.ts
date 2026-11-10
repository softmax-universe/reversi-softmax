import { readFile, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { launchEnvironment } from "@softmax-universe/local-cli";
import { verifyPolicy } from "./verify-policy.js";

const { values } = parseArgs({
  options: {
    policy: { type: "string", default: "/workspace/policy.js" },
    output: { type: "string", default: "/logs/verifier" },
    release: { type: "string", default: "/opt/reversi/release.json" },
    state: { type: "string", default: "/var/lib/reversi/harbor" },
    port: { type: "string", default: "4328" },
  },
});
const policy = await stat(values.policy);
if (!policy.isFile() || policy.size > 200_000)
  throw new Error("The policy must be a file of at most 200000 bytes.");
const code = await readFile(values.policy, "utf8");
const output = resolve(values.output);
await mkdir(output, { recursive: true, mode: 0o700 });
const runtime = await launchEnvironment({
  releaseManifest: resolve(values.release),
  stateDirectory: resolve(values.state),
  port: Number(values.port),
});
try {
  const result = await verifyPolicy({ client: runtime.client, code });
  await writeFile(`${output}/recording.json`, `${JSON.stringify(result.recording, null, 2)}\n`, {
    mode: 0o600,
  });
  await writeFile(
    `${output}/verification.json`,
    `${JSON.stringify({ ...result, recording: undefined }, null, 2)}\n`,
    { mode: 0o600 },
  );
  const reward: Record<string, number> = { success: result.passed ? 1 : 0 };
  if (result.averageScore !== null) reward.averageScore = result.averageScore;
  await writeFile(`${output}/reward.json`, `${JSON.stringify(reward)}\n`, { mode: 0o600 });
} finally {
  await runtime.close();
}
