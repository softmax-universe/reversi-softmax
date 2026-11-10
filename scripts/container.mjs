import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { verifyRelease } from "@softmax-universe/distribution";

const { values } = parseArgs({
  options: {
    application: { type: "string" },
    output: { type: "string" },
    base: { type: "string" },
    evidence: { type: "string" },
  },
});
if (
  !values.application ||
  !values.output ||
  !values.evidence ||
  !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*@sha256:[a-f0-9]{64}$/.test(values.base ?? "")
) {
  throw new Error(
    "Use --application <native Linux installation> --base <image@sha256:digest> --output <new OCI archive> --evidence <new directory>.",
  );
}
const release = await verifyRelease(join(resolve(values.application), "release.json"));
assert.equal(release.manifest.target, "linux-x64");
const output = resolve(values.output);
assert.equal(await lstat(output).catch(missing), undefined, "OCI output already exists.");
const evidence = resolve(values.evidence);
await mkdir(evidence, { recursive: false });
await mkdir(dirname(output), { recursive: true });
const scratch = await mkdtemp(join(dirname(output), ".reversi-container-"));
const builder = `reversi-${randomUUID()}`;
const image = `${builder}:qualified`;
const container = `${builder}-verifier`;
const temporary = `${output}.${builder}`;
let createdBuilder = false;
let createdContainer = false;
try {
  const application = join(scratch, "application");
  await mkdir(application);
  const files = [
    release.manifest.worker.file,
    ...release.manifest.assets.files,
    ...Object.values(release.manifest.tools),
    ...release.manifest.launcher.files,
    ...release.manifest.notices,
    ...release.manifest.applicationFiles,
  ];
  for (const file of files) {
    const destination = join(application, file.path);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(release.root, file.path), destination, 1);
    assert.equal(
      createHash("sha256")
        .update(await readFile(destination))
        .digest("hex"),
      file.sha256,
      "A verified installation file changed during packaging.",
    );
    await chmod(destination, (await lstat(join(release.root, file.path))).mode & 0o777);
  }
  await copyFile(release.manifestPath, join(application, "release.json"), 1);
  await copyFile("harnesses/container/Dockerfile", join(scratch, "Dockerfile"), 1);
  run(["buildx", "create", "--name", builder, "--driver", "docker-container"]);
  createdBuilder = true;
  run([
    "buildx",
    "build",
    "--builder",
    builder,
    "--platform",
    "linux/amd64",
    "--build-arg",
    `BASE_IMAGE=${values.base}`,
    "--label",
    `org.opencontainers.image.revision=${release.manifest.provenance.environmentSourceRevision}`,
    "--label",
    "org.opencontainers.image.source=https://github.com/softmax-universe/reversi-factory",
    "--label",
    "org.opencontainers.image.url=https://github.com/softmax-universe/reversi-softmax",
    "--tag",
    image,
    "--output",
    `type=oci,dest=${temporary}`,
    scratch,
  ]);
  await copyFile(temporary, output, 1);
  await rm(temporary);
  run(["load", "--input", output]);
  const imageId = run(["image", "inspect", image, "--format", "{{.Id}}"], true).trim();
  assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  const solution = await readFile("harnesses/harbor/write-policy/solution/solve.sh", "utf8");
  const policy = join(scratch, "policy.js");
  await writeFile(policy, `${solution.split("<<'POLICY'\n")[1].split("\nPOLICY")[0]}\n`, {
    mode: 0o644,
  });
  run([
    "create",
    "--name",
    container,
    "--network",
    "none",
    "--label",
    `reversi.qualification=${builder}`,
    "--mount",
    `type=bind,source=${policy},target=/workspace/policy.js,readonly`,
    "--entrypoint",
    "/usr/bin/tini",
    imageId,
    "--",
    "/opt/reversi/bin/reversi-harbor-verify",
  ]);
  createdContainer = true;
  run(["start", "--attach", container]);
  assert.equal(run(["inspect", container, "--format", "{{.State.ExitCode}}"], true).trim(), "0");
  run(["cp", `${container}:/logs/verifier/.`, evidence]);
  const verification = JSON.parse(await readFile(join(evidence, "verification.json"), "utf8"));
  assert.equal(verification.passed, true);
  await writeFile(
    join(evidence, "image.json"),
    `${JSON.stringify(
      {
        imageId,
        archiveSha256: createHash("sha256")
          .update(await readFile(output))
          .digest("hex"),
        base: values.base,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  if (createdContainer) run(["rm", "--force", container]);
  if (createdBuilder) run(["buildx", "rm", "--force", builder]);
  await rm(temporary, { force: true });
  await rm(scratch, { recursive: true, force: true });
}

function run(args, capture = false) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    timeout: 1200000,
  });
}
function missing(error) {
  if (error.code === "ENOENT") return undefined;
  throw error;
}
