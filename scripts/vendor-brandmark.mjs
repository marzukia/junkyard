#!/usr/bin/env node
/**
 * vendor-brandmark.mjs
 *
 * Copies kit/components/BrandMark.tsx into each app's src/components/ directory,
 * but ONLY for apps that use the wrapper form (children-prop API).
 *
 * Nine apps ship intentionally self-contained glyph variants under the same
 * filename — their BrandMark is the tool's unique icon, not the generic wrapper.
 * Vendoring into those apps would clobber their tool-specific artwork.
 *
 * SKIP LIST (custom-glyph apps — do not touch):
 *   collage, convert, crop, exif, gif, meme, og, screenshot, video
 *
 * All other apps (36 wrapper-form apps) receive the canonical wrapper.
 *
 * Run from repo root: node scripts/vendor-brandmark.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const SRC = join(REPO_ROOT, "kit", "components", "BrandMark.tsx");

/**
 * Apps with intentional per-tool self-contained glyph BrandMarks.
 * These are NOT drift — they are the tool's unique icon and must never be
 * overwritten by the generic wrapper canonical.
 */
const CUSTOM_GLYPH_APPS = new Set([
  "collage",
  "convert",
  "crop",
  "exif",
  "gif",
  "meme",
  "og",
  "screenshot",
  "video",
]);

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/components/BrandMark.tsx to exist in the repo root.");
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
  const dest = join(APPS_DIR, slug, "src", "components", "BrandMark.tsx");

  if (!existsSync(dest)) {
    console.warn(`[SKIP] ${slug}: no src/components/BrandMark.tsx found`);
    skippedCount++;
    continue;
  }

  if (CUSTOM_GLYPH_APPS.has(slug)) {
    console.log(`[SKIP] ${slug}: custom-glyph BrandMark (intentional, not drift)`);
    skippedCount++;
    continue;
  }

  try {
    const existing = readFileSync(dest, "utf8");
    if (existing === canonical) {
      console.log(`[OK ] ${slug}: apps/${slug}/src/components/BrandMark.tsx`);
      alreadyOkCount++;
    } else {
      writeFileSync(dest, canonical, "utf8");
      console.log(`[MOD] ${slug}: apps/${slug}/src/components/BrandMark.tsx`);
      modifiedCount++;
    }
  } catch (err) {
    console.error(`[ERROR] ${slug}: failed to vendor BrandMark.tsx: ${err.message}`);
    errorCount++;
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${skippedCount} skipped (${CUSTOM_GLYPH_APPS.size} custom-glyph + no-file), ${slugs.length} total apps.`);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
