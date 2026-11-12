import { execFileSync } from "node:child_process";

execFileSync(process.execPath, ["scripts/fetch-runtime.mjs"], { stdio: "inherit" });
const environment = { ...process.env };
for (const name of ["GH_TOKEN", "GITHUB_TOKEN", "NODE_AUTH_TOKEN", "NPM_TOKEN"])
  delete environment[name];
for (const args of [["install", "--frozen-lockfile"], ["architecture:setup"]]) {
  execFileSync("pnpm", args, { env: environment, stdio: "inherit" });
}
