import { build } from "esbuild";
import fs from "node:fs/promises";
export async function buildLifecycleHarness() {
  await build({
    entryPoints: ["tests/support/lifecycle-harness.tsx"],
    bundle: true,
    minify: true,
    target: "es2022",
    define: { "process.env.NODE_ENV": '"production"' },
    format: "iife",
    outfile: "dist/lifecycle-qa.js",
  });
  await fs.writeFile(
    "dist/lifecycle-qa.html",
    '<!doctype html><html lang="vi"><head><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body><div id="root" class="app"></div><script src="/lifecycle-qa.js"></script></body></html>',
  );
}
