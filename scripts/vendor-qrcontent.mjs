#!/usr/bin/env node
/**
 * vendor-qrcontent.mjs
 *
 * Copies kit/lib/qrContent.ts (canonical WiFi/vCard QR payload builders) into:
 *   apps/qr/src/lib/qrContent.ts
 *   apps/barcode/src/lib/qrContent.ts
 *
 * Both apps import buildWifiPayload / buildVCardPayload / escapeWifiField from
 * the vendored copy. The inline implementations in apps/qr/src/lib/templates.ts
 * and apps/barcode/src/lib/qr.ts now delegate to the vendored copy, ensuring
 * identical spec-correct payloads from both apps.
 *
 * Run from repo root: node scripts/vendor-qrcontent.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "qrContent.ts");

const TARGETS = [
  join(REPO_ROOT, "apps", "qr", "src", "lib", "qrContent.ts"),
  join(REPO_ROOT, "apps", "barcode", "src", "lib", "qrContent.ts"),
];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/qrContent.ts to exist in the repo root.");
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
