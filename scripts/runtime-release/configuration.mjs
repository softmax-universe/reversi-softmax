import { readFileSync } from "node:fs";

export const runtimeRelease = JSON.parse(
  readFileSync(new URL("../../runtime-release.json", import.meta.url), "utf8"),
);
