#!/usr/bin/env node
/**
 * vendor-cron-grammar.mjs
 *
 * Copies kit/lib/cronGrammar.ts (canonical cron field-grammar: CRON_MACROS,
 * FIELD_SPECS, FIELD_ORDER, expandMacro, normaliseNames, validateSinglePart,
 * expandField) into:
 *   apps/cron/src/lib/cronGrammar.ts
 *
 * apps/cron imports the grammar from this vendored copy and adds its own
 * LOCAL-time nextRuns, human describers, presets, and timezone helpers on top.
 *
 * packages/core/src/cron.ts keeps its own reconciled copy with a SYNC note
 * (core has no kit dependency — it ships standalone). When cronGrammar.ts
 * changes, reconcile core manually before committing.
 *
 * Run from repo root: node scripts/vendor-cron-grammar.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "cronGrammar.ts");

const TARGETS = [join(REPO_ROOT, "apps", "cron", "src", "lib", "cronGrammar.ts")];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/cronGrammar.ts to exist in the repo root.");
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

for (const dest of TARGETS) {
  const label = dest.replace(REPO_ROOT + "/", "");

  if (!existsSync(dest)) {
    try {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[NEW] ${label}`);
      modifiedCount++;
    } catch (err) {
      console.error(`[ERROR] Could not create ${label}: ${err.message}`);
      errorCount++;
    }
    continue;
  }

  try {
    const existing = readFileSync(dest, "utf8");
    if (existing === canonical) {
      console.log(`[OK ] ${label}`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${label}`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] ${label}: ${err.message}`);
    errorCount++;
  }
}

console.log(
  `\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${TARGETS.length} targets total.`
);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
