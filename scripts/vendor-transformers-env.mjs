#!/usr/bin/env node
/**
 * vendor-transformers-env.mjs
 *
 * Copies kit/components/transformersEnv.ts into each AI app's src/lib/ directory.
 * The file is kept identical across all copies -- edit kit/components/transformersEnv.ts
 * then run this script to propagate the change.
 *
 * Run from repo root: node scripts/vendor-transformers-env.mjs
 * Safe to re-run (idempotent).
 */

import { copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "components", "transformersEnv.ts");
const AI_APPS = ["bg", "caption", "depth", "translate", "upscale"];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Source file not found: ${SRC}`);
  console.error("        Expected kit/components/transformersEnv.ts to exist in the repo root.");
  process.exit(1);
}

let errorCount = 0;
for (const app of AI_APPS) {
  const dest = join(REPO_ROOT, "apps", app, "src", "lib", "transformersEnv.ts");
  try {
    copyFileSync(SRC, dest);
    console.log(`vendored -> apps/${app}/src/lib/transformersEnv.ts`);
  } catch (err) {
    console.error(`[ERROR] Failed to vendor into apps/${app}: ${err.message}`);
    console.error(`        Source: ${SRC}`);
    console.error(`        Destination: ${dest}`);
    errorCount++;
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} error(s) occurred. Destination directories may not exist.`);
  process.exit(1);
}
