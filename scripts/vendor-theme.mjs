#!/usr/bin/env node
/**
 * vendor-theme.mjs
 *
 * Copies kit/theme.ts (the SUPERSET canonical) into every app that ships
 * src/theme.ts, reconciling all historical drift variants into one file.
 *
 * The canonical is the union of every component override ever present in any
 * variant (TextInput + Slider + Popover) plus the full doc-comment.  Apps that
 * previously lacked a given override now carry it harmlessly — no styling is
 * lost, only gained where it was missing.
 *
 * SKIP LIST (apps that do NOT use Mantine / have no src/theme.ts):
 *   colours, exif, favicon, ocr
 *
 * Run from repo root: node scripts/vendor-theme.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const SRC = join(REPO_ROOT, "kit", "theme.ts");

/**
 * Apps that do not use Mantine and therefore have no src/theme.ts.
 * These are NOT drift — they are intentionally theme-free.
 */
const NO_THEME_APPS = new Set(["colours", "exif", "favicon", "ocr"]);

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/theme.ts to exist in the repo root.");
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
  const dest = join(APPS_DIR, slug, "src", "theme.ts");

  if (!existsSync(dest)) {
    console.log(`[SKIP] ${slug}: no src/theme.ts (intentional — not a Mantine app)`);
    skippedCount++;
    continue;
  }

  if (NO_THEME_APPS.has(slug)) {
    console.log(`[SKIP] ${slug}: no-theme app (intentional)`);
    skippedCount++;
    continue;
  }

  try {
    const existing = readFileSync(dest, "utf8");
    if (existing === canonical) {
      console.log(`[OK ] ${slug}: apps/${slug}/src/theme.ts`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${slug}: apps/${slug}/src/theme.ts`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] ${slug}: failed to vendor theme.ts: ${err.message}`);
    errorCount++;
  }
}

console.log(
  `\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${skippedCount} skipped (no src/theme.ts), ${slugs.length} total apps.`
);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
