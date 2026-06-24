#!/usr/bin/env node
/**
 * vendor-mobilewarning.mjs
 *
 * Copies kit/components/MobileWarning.tsx and kit/components/MobileWarning.css
 * into each app's src/components/ directory.
 * The files are kept identical across all vendored copies — edit the kit
 * canonicals then run this script to propagate the change.
 *
 * Target apps: the 10 apps that ship MobileWarning.
 *
 * Run from repo root: node scripts/vendor-mobilewarning.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const KIT_DIR = join(REPO_ROOT, "kit", "components");

const SRC_TSX = join(KIT_DIR, "MobileWarning.tsx");
const SRC_CSS = join(KIT_DIR, "MobileWarning.css");

// Apps that ship MobileWarning (tsx + css).
const TARGET_APPS = [
  "bg",
  "caption",
  "chat",
  "depth",
  "screen-recorder",
  "summarize",
  "transcribe",
  "translate",
  "upscale",
  "video",
];

for (const [label, path] of [["MobileWarning.tsx", SRC_TSX], ["MobileWarning.css", SRC_CSS]]) {
  if (!existsSync(path)) {
    console.error(`[ERROR] Canonical source not found: ${path}`);
    console.error(`        Expected kit/components/${label} to exist in the repo root.`);
    process.exit(1);
  }
}

let canonicalTsx, canonicalCss;
try {
  canonicalTsx = readFileSync(SRC_TSX, "utf8");
  canonicalCss = readFileSync(SRC_CSS, "utf8");
} catch (err) {
  console.error(`[ERROR] Could not read canonical sources: ${err.message}`);
  process.exit(1);
}

let modifiedCount = 0;
let alreadyOkCount = 0;
let errorCount = 0;

for (const app of TARGET_APPS) {
  const destDir = join(REPO_ROOT, "apps", app, "src", "components");
  const destTsx = join(destDir, "MobileWarning.tsx");
  const destCss = join(destDir, "MobileWarning.css");

  for (const [dest, canonical, label] of [
    [destTsx, canonicalTsx, "MobileWarning.tsx"],
    [destCss, canonicalCss, "MobileWarning.css"],
  ]) {
    try {
      if (existsSync(dest) && readFileSync(dest, "utf8") === canonical) {
        console.log(`[OK ] ${app}: apps/${app}/src/components/${label}`);
        alreadyOkCount++;
      } else {
        writeFileSync(dest, canonical, "utf8");
        console.log(`[MOD] ${app}: apps/${app}/src/components/${label}`);
        modifiedCount++;
      }
    } catch (err) {
      console.error(`[ERROR] Failed to vendor ${label} into apps/${app}: ${err.message}`);
      errorCount++;
    }
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${alreadyOkCount} already up to date, ${TARGET_APPS.length} total apps.`);

if (errorCount > 0) {
  console.error(`${errorCount} error(s) occurred during vendoring.`);
  process.exit(1);
}
