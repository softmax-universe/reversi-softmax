import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { reversiEnvironment } from "../dist/environment/index.js";

await mkdir("dist/console", { recursive: true });
await build({
  entryPoints: ["app/view/console.tsx"],
  outfile: "dist/console/console.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2023",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
const html = await readFile("app/view/console.html", "utf8");
await writeFile("dist/console/index.html", html);
await writeFile(
  "dist/environment.json",
  `${JSON.stringify(reversiEnvironment.manifest, null, 2)}\n`,
);
const entries = [
  ["/", { type: "text/html; charset=utf-8", content: html }],
  [
    "/console.js",
    {
      type: "text/javascript; charset=utf-8",
      content: await readFile("dist/console/console.js", "utf8"),
    },
  ],
  [
    "/console.css",
    {
      type: "text/css; charset=utf-8",
      content: await readFile("dist/console/console.css", "utf8"),
    },
  ],
];
await build({
  entryPoints: ["app/worker/index.ts"],
  outfile: "dist/worker/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2023",
  external: ["cloudflare:*", "node:*"],
  banner: { js: 'import __reversiAssert from "node:assert";' },
  plugins: [
    {
      name: "reversi-assets",
      setup(builder) {
        builder.onResolve({ filter: /^assert$/ }, () => ({
          path: "assert",
          namespace: "reversi-assert",
        }));
        builder.onLoad({ filter: /.*/, namespace: "reversi-assert" }, () => ({
          contents: "module.exports = __reversiAssert;",
          loader: "js",
        }));
        builder.onResolve({ filter: /^reversi:assets$/ }, () => ({
          path: "assets",
          namespace: "reversi",
        }));
        builder.onLoad({ filter: /.*/, namespace: "reversi" }, () => ({
          contents: `export default new Map(${JSON.stringify(entries)});`,
          loader: "js",
        }));
      },
    },
  ],
});
await build({
  entryPoints: ["app/benchmarks/harbor.ts"],
  outfile: "dist/harbor/verify.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  target: "es2023",
});
const paths = [
  "dist/environment.json",
  "dist/worker/index.js",
  "dist/console/index.html",
  "dist/console/console.js",
  "dist/console/console.css",
  "dist/harbor/verify.mjs",
];
const files = [];
for (const path of paths) {
  const contents = await readFile(path);
  files.push({
    path,
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}
await writeFile("dist/application.json", `${JSON.stringify({ format: 1, files }, null, 2)}\n`);
