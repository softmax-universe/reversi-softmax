import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { runtimeRelease } from "./configuration.mjs";

export function readRuntimeRelease() {
  const core = runtimeRelease;
  const api = `repos/${core.repository}`;
  const repository = document(api);
  assert.equal(repository.id, core.id, "Runtime repository identity changed");
  assert.equal(repository.owner.id, core.ownerId, "Runtime owner changed");
  assert.equal(repository.private, true, "Runtime distribution must remain private");
  const release = document(`${api}/releases/tags/v${core.version}`);
  assert.equal(release.immutable, true, "Runtime release must be immutable");
  assert.equal(release.draft, false);
  const manifestAsset = release.assets.find((asset) => asset.name === "manifest.json");
  assert.ok(manifestAsset, "Runtime manifest is missing");
  const bytes = execFileSync(
    "gh",
    [
      "api",
      "--hostname",
      "github.com",
      `${api}/releases/assets/${manifestAsset.id}`,
      "--header",
      "Accept: application/octet-stream",
    ],
    { maxBuffer: 2_000_000 },
  );
  assert.equal(digest(bytes), core.manifestSha256, "Runtime manifest checksum changed");
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.target.id, core.id);
  assert.equal(manifest.target.repository, core.repository);
  assert.ok(manifest.packages.every((item) => item.version === core.version));
  return { release, manifest, bytes };
}

function document(path) {
  return JSON.parse(
    execFileSync("gh", ["api", "--hostname", "github.com", path], {
      encoding: "utf8",
      maxBuffer: 2_000_000,
      timeout: 30_000,
    }),
  );
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
