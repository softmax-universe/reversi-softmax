import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname } from "node:path";
import { runtimeRelease } from "./configuration.mjs";

export function downloadRuntimeAsset(runtime, name, path) {
  assert.match(name, /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/);
  const expected = runtime.manifest.files[name];
  assert.match(expected ?? "", /^[a-f0-9]{64}$/, `Unverified runtime asset: ${name}`);
  if (existsSync(path)) {
    assert.equal(digest(readFileSync(path)), expected, `Runtime asset checksum changed: ${name}`);
    return;
  }
  const asset = runtime.release.assets.find((entry) => entry.name === name);
  assert.ok(asset, `Runtime asset is missing: ${name}`);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.partial`;
  const output = openSync(temporary, "wx", 0o600);
  try {
    const result = spawnSync(
      "gh",
      [
        "api",
        "--hostname",
        "github.com",
        `repos/${runtimeRelease.repository}/releases/assets/${asset.id}`,
        "--header",
        "Accept: application/octet-stream",
      ],
      { stdio: ["ignore", output, "pipe"], timeout: 120_000 },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, `Authorized runtime download failed: ${name}`);
    assert.equal(
      digest(readFileSync(temporary)),
      expected,
      `Runtime asset checksum changed: ${name}`,
    );
    renameSync(temporary, path);
  } finally {
    closeSync(output);
    rmSync(temporary, { force: true });
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
