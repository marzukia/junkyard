#!/usr/bin/env node
/**
 * vendor-themetoggle.mjs
 *
 * For each apps/<slug>/:
 *   1. Finds the ThemeToggle.tsx file (under src/components/ or src/kit/components/).
 *   2. Overwrites it with the canonical kit/components/ThemeToggle.tsx.
 *
 * The ThemeToggle is used inline (imported as "./ThemeToggle" by Header.tsx or
 * equivalent in the same directory), so no import-injection is needed -- the
 * existing import already points to the file we are overwriting.
 *
 * Run from repo root: node scripts/vendor-themetoggle.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const KIT_DIR = join(REPO_ROOT, "kit", "components");

const SOURCE_TSX = join(KIT_DIR, "ThemeToggle.tsx");

if (!existsSync(SOURCE_TSX)) {
  console.error(`[ERROR] Canonical source not found: ${SOURCE_TSX}`);
  console.error("        Expected kit/components/ThemeToggle.tsx to exist in the repo root.");
  process.exit(1);
}

let canonical;
try {
  canonical = readFileSync(SOURCE_TSX, "utf8");
} catch (err) {
  console.error(`[ERROR] Could not read canonical source: ${SOURCE_TSX}`);
  console.error(`        ${err.message}`);
  process.exit(1);
}

// Recursively find all .tsx files under a directory.
function findTsx(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsx(full));
    } else if (entry.isFile() && entry.name === "ThemeToggle.tsx") {
      results.push(full);
    }
  }
  return results;
}

const slugs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let modifiedCount = 0;
let alreadyOkCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const slug of slugs) {
  const srcDir = join(APPS_DIR, slug, "src");
  let files;
  try {
    files = findTsx(srcDir);
  } catch (err) {
    console.warn(`[SKIP] ${slug}: could not scan src directory: ${err.message}`);
    skippedCount++;
    continue;
  }

  if (files.length === 0) {
    console.warn(`[SKIP] ${slug}: no ThemeToggle.tsx found`);
    skippedCount++;
    continue;
  }

  if (files.length > 1) {
    console.warn(`  [WARN] ${slug}: multiple ThemeToggle.tsx found, vendoring all`);
  }

  for (const file of files) {
    try {
      const existing = readFileSync(file, "utf8");
      if (existing === canonical) {
        console.log(`[OK ] ${slug}: ${file.replace(REPO_ROOT + "/", "")}`);
        alreadyOkCount++;
      } else {
        writeFileSync(file, canonical, "utf8");
        console.log(`[MOD] ${slug}: ${file.replace(REPO_ROOT + "/", "")}`);
        modifiedCount++;
      }
    } catch (err) {
      console.error(`[ERROR] ${slug}: failed to vendor ${file.replace(REPO_ROOT + "/", "")}: ${err.message}`);
      errorCount++;
    }
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${skippedCount} skipped, ${slugs.length} total apps.`);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
