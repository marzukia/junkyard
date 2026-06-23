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

import { copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "components", "transformersEnv.ts");
const AI_APPS = ["bg", "caption", "depth", "translate", "upscale"];

for (const app of AI_APPS) {
  const dest = join(REPO_ROOT, "apps", app, "src", "lib", "transformersEnv.ts");
  copyFileSync(SRC, dest);
  console.log(`vendored -> apps/${app}/src/lib/transformersEnv.ts`);
}
