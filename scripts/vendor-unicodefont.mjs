#!/usr/bin/env node
/**
 * vendor-unicodefont.mjs
 *
 * Copies kit/lib/unicodeFont.ts (canonical) into the four PDF-generating apps
 * that embed Unicode fonts via pdf-lib:
 *   apps/invoice/src/lib/unicodeFont.ts
 *   apps/pdf/src/lib/unicodeFont.ts
 *   apps/resume/src/lib/unicodeFont.ts
 *   apps/sign/src/lib/unicodeFont.ts
 *
 * apps/ocr uses a superset (ocrPdfUtils.ts) with per-script font selection
 * (CJK, Arabic, Latin) that is out of scope for this canonical; its Noto Sans
 * base URL is identical to the one here.  The ocr file documents that it shares
 * the same CDN URL as this canonical.
 *
 * Run from repo root: node scripts/vendor-unicodefont.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "unicodeFont.ts");

const TARGETS = [
  join(REPO_ROOT, "apps", "invoice", "src", "lib", "unicodeFont.ts"),
  join(REPO_ROOT, "apps", "pdf", "src", "lib", "unicodeFont.ts"),
  join(REPO_ROOT, "apps", "resume", "src", "lib", "unicodeFont.ts"),
  join(REPO_ROOT, "apps", "sign", "src", "lib", "unicodeFont.ts"),
];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/unicodeFont.ts to exist in the repo root.");
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
    console.error(`[ERROR] Target not found: ${dest}`);
    console.error("        The app may have moved; update TARGETS in this script.");
    errorCount++;
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
