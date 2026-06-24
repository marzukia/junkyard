#!/usr/bin/env node
/**
 * vendor-header.mjs
 *
 * Copies kit/components/Header.tsx into each app's src/components/ directory.
 * The canonical includes AppSwitcher — the app-switcher import and element are
 * part of the canonical form (Header owns the utility-bar; vendor-switcher.mjs
 * is no longer needed to inject them separately into Header).
 *
 * Run from repo root: node scripts/vendor-header.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const SRC = join(REPO_ROOT, "kit", "components", "Header.tsx");

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/components/Header.tsx to exist in the repo root.");
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

const slugs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let modifiedCount = 0;
let alreadyOkCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const slug of slugs) {
  const dest = join(APPS_DIR, slug, "src", "components", "Header.tsx");

  if (!existsSync(dest)) {
    console.warn(`[SKIP] ${slug}: no src/components/Header.tsx found`);
    skippedCount++;
    continue;
  }

  try {
    const existing = readFileSync(dest, "utf8");
    if (existing === canonical) {
      console.log(`[OK ] ${slug}: apps/${slug}/src/components/Header.tsx`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${slug}: apps/${slug}/src/components/Header.tsx`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] ${slug}: failed to vendor Header.tsx: ${err.message}`);
    errorCount++;
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${skippedCount} skipped, ${slugs.length} total apps.`);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
