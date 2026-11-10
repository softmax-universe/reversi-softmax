import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { to: { type: "string" }, image: { type: "string" } } });
if (
  !values.to ||
  !values.image ||
  !/^(?:[a-zA-Z0-9][a-zA-Z0-9._:/-]*@)?sha256:[a-f0-9]{64}$/.test(values.image)
) {
  throw new Error(
    "Usage: pnpm harbor:prepare --to <new directory> --image <registry/image@sha256:digest>",
  );
}
const source = resolve("harnesses/harbor/write-policy");
const destination = resolve(values.to);
const between = relative(source, destination);
if (between === "" || (!between.startsWith("..") && !isAbsolute(between))) {
  throw new Error("Prepare the task outside its source directory.");
}
try {
  await stat(destination);
  throw new Error("The Harbor task destination already exists.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await mkdir(destination, { recursive: false });
for (const path of ["instruction.md", "tests", "solution", "environment"]) {
  await cp(`${source}/${path}`, `${destination}/${path}`, { recursive: true, errorOnExist: true });
}
const template = await readFile(`${source}/task.template.toml`, "utf8");
await writeFile(`${destination}/task.toml`, template.replace("{{IMAGE}}", values.image));
