#!/usr/bin/env node
/**
 * vendor-format.mjs
 *
 * Copies kit/components/format.ts into each app's src/lib/ directory.
 * The file is kept identical across all vendored copies -- edit
 * kit/components/format.ts then run this script to propagate the change.
 *
 * Apps with divergent formatBytes behaviour (chat, convert, json, svg, pdf,
 * video) define their own local implementation and are NOT in this list.
 *
 * Run from repo root: node scripts/vendor-format.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "components", "format.ts");

// Apps that share the canonical .toFixed(1) formatBytes implementation.
const TARGET_APPS = ["bg", "caption", "cleanup", "depth", "transcribe", "upscale"];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Source file not found: ${SRC}`);
  console.error("        Expected kit/components/format.ts to exist in the repo root.");
  process.exit(1);
}

let canonical;
try {
  canonical = readFileSync(SRC, "utf8");
} catch (err) {
  console.error(`[ERROR] Could not read canonical source: ${SRC}`);
  console.error(`        ${err.message}`);
  process.exit(1);
}

let modifiedCount = 0;
let alreadyOkCount = 0;
let errorCount = 0;

for (const app of TARGET_APPS) {
  const dest = join(REPO_ROOT, "apps", app, "src", "lib", "format.ts");
  try {
    if (existsSync(dest) && readFileSync(dest, "utf8") === canonical) {
      console.log(`[OK ] ${app}: apps/${app}/src/lib/format.ts`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${app}: apps/${app}/src/lib/format.ts`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] Failed to vendor into apps/${app}: ${err.message}`);
    console.error(`        Source: ${SRC}`);
    console.error(`        Destination: ${dest}`);
    errorCount++;
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${TARGET_APPS.length} total apps.`);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
