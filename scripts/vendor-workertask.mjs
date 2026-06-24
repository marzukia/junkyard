#!/usr/bin/env node
/**
 * vendor-workertask.mjs
 *
 * Copies kit/lib/workerTask.ts into each AI app's src/lib/ directory.
 * The file is kept identical across all vendored copies — edit
 * kit/lib/workerTask.ts then run this script to propagate the change.
 *
 * Target apps: the 7 AI apps that use the Web Worker inference pattern.
 *
 * Run from repo root: node scripts/vendor-workertask.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "workerTask.ts");

// The 7 AI apps that share the canonical useWorkerTask hook.
const TARGET_APPS = ["bg", "caption", "depth", "summarize", "transcribe", "translate", "upscale"];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/workerTask.ts to exist in the repo root.");
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
  const dest = join(REPO_ROOT, "apps", app, "src", "lib", "workerTask.ts");
  try {
    if (existsSync(dest) && readFileSync(dest, "utf8") === canonical) {
      console.log(`[OK ] ${app}: apps/${app}/src/lib/workerTask.ts`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${app}: apps/${app}/src/lib/workerTask.ts`);
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
