#!/usr/bin/env node
/**
 * vendor-base64url.mjs
 *
 * Copies kit/lib/base64url.ts (canonical RFC 4648 §5 codec) into the three
 * apps that use base64url encoding/decoding:
 *   apps/base64/src/lib/base64url.ts
 *   apps/jwt/src/lib/base64url.ts
 *   apps/colours/src/lib/base64url.ts
 *
 * Run from repo root: node scripts/vendor-base64url.mjs
 * Safe to re-run (idempotent).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SRC = join(REPO_ROOT, "kit", "lib", "base64url.ts");

const TARGETS = [
  join(REPO_ROOT, "apps", "base64", "src", "lib", "base64url.ts"),
  join(REPO_ROOT, "apps", "jwt", "src", "lib", "base64url.ts"),
  join(REPO_ROOT, "apps", "colours", "src", "lib", "base64url.ts"),
];

if (!existsSync(SRC)) {
  console.error(`[ERROR] Canonical source not found: ${SRC}`);
  console.error("        Expected kit/lib/base64url.ts to exist in the repo root.");
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
    // Create the file — it is new for this canonical
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
