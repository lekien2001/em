import { build } from "esbuild";
import fs from "node:fs/promises";
export async function buildAudioHarness() {
  await build({
    entryPoints: ["tests/support/audio-harness.ts"],
    bundle: true,
    minify: true,
    target: "es2022",
    format: "iife",
    outfile: "dist/audio-qa.js",
  });
  await fs.writeFile(
    "dist/audio-qa.html",
    '<!doctype html><html lang="vi"><head><link rel="icon" href="data:,"></head><body><script src="/audio-qa.js"></script></body></html>',
  );
}
