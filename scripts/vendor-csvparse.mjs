#!/usr/bin/env node
/**
 * vendor-csvparse.mjs
 *
 * Copies kit/lib/csvParse.ts (canonical RFC 4180 parser + delimiter-detection
 * heuristic) into:
 *   apps/csv/src/lib/csvParse.ts
 *
 * The apps/csv/src/lib/csv.ts file imports splitCsvRows and detectDelimiter
 * from ./csvParse rather than reimplementing them.
 *
 * Run from repo root: node scripts/vendor-csvparse.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "csvParse.ts");

const TARGETS = [
  join(REPO_ROOT, "apps", "csv", "src", "lib", "csvParse.ts"),
];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/csvParse.ts to exist in the repo root.");
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
