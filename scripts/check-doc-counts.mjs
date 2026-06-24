#!/usr/bin/env bun
// Guard: tool count stated in documentation must match the real apps/ directory count.
//
// The number "44" appears in several prose files and has drifted in the past.
// This script computes the authoritative count (number of apps/*/junkyard.ts files)
// and asserts each targeted doc file states the same count — so adding an app
// without updating the docs fails CI before the PR merges.
//
// Robustness notes:
// - Matches only specific count+context phrases (not every occurrence of the integer)
//   to avoid false positives from unrelated numeric references.
// - The regex anchors the count to immediately adjacent tool-count phrases so that
//   e.g. "44 apps" in a technical sentence but "45 free tools" in prose fails correctly.
// - Adding a new doc file: extend DOC_CHECKS below with its path and patterns.

import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;
const appsDir = join(root, "apps");

// Authoritative count: number of app dirs that have a junkyard.ts manifest.
const appCount = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(appsDir, d.name, "junkyard.ts")))
  .length;

// Each entry: file path (relative to repo root) and an array of regexes that
// must each match the CORRECT count (appCount) in the file.
// The patterns are specific enough to avoid false positives on adjacent numbers.
const DOC_CHECKS = [
  {
    file: "README.md",
    // Matches: "44 free, 100% client-side web tools"
    //          "Each of the 44 tools is a self-contained"
    //          "Builds all 44 apps + the hub"
    patterns: [
      /\b(\d+)\s+free,\s+100%\s+client-side/,
      /Each\s+of\s+the\s+(\d+)\s+tools\s+is/,
      /Builds\s+all\s+(\d+)\s+apps/,
    ],
  },
  {
    file: "CONTRIBUTING.md",
    // Matches: "A monorepo of 44 free, client-side"
    //          "apps/<slug>/        # 44 standalone Vite apps"
    patterns: [
      /monorepo\s+of\s+(\d+)\s+free,\s+client-side/,
      /apps\/<slug>\/\s+#\s+(\d+)\s+standalone/,
    ],
  },
  {
    file: "docs/ARCHITECTURE.md",
    // Matches: "The 44 apps have divergent"
    //          "across all 44 apps and must be full-build-verified"
    patterns: [
      /The\s+(\d+)\s+apps\s+have\s+divergent/,
      /all\s+(\d+)\s+apps\s+and\s+must\s+be\s+full-build-verified/,
    ],
  },
];

let errors = [];

for (const { file, patterns } of DOC_CHECKS) {
  const fullPath = join(root, file);
  let content;
  try {
    content = readFileSync(fullPath, "utf8");
  } catch {
    errors.push(`${file}: file not found`);
    continue;
  }

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (!match) {
      // Pattern didn't match at all — the prose may have changed shape.
      // This is a guard failure: the doc text drifted from the expected phrasing.
      errors.push(
        `${file}: expected pattern ${pattern} not found — doc phrasing may have changed; update DOC_CHECKS in check-doc-counts.mjs`,
      );
      continue;
    }
    const stated = Number(match[1]);
    if (stated !== appCount) {
      errors.push(
        `${file}: doc states ${stated} tools/apps but apps/ has ${appCount} — update the prose to match`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`doc-count guard FAILED (authoritative count: ${appCount} apps):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(`doc-count guard OK — all checked docs agree: ${appCount} tools/apps`);
