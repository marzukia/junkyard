#!/usr/bin/env bun
// Guard: tool count stated in documentation must match the real apps/ directory count.
//
// The number "44" appears in several prose files and has drifted in the past.
// This script computes the authoritative count (number of apps/*/junkyard.ts files)
// and asserts each targeted doc file states the same count — so adding an app
// without updating the docs fails CI before the PR merges.
//
// Extended (connascence w2): also guards the 17/25/28 sub-counts derived from
// @junkyard/core TOOLS — coreCount (17 headless tools), opCount (25 ops), and
// clientCount (45−17=28 client-only tools). These are computed from the live
// package source so they update automatically when TOOLS changes.
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

// Authoritative sub-counts from @junkyard/core — the single source of truth for
// which tools are headless and how many ops each exposes.
const { TOOLS } = await import(join(root, "packages/core/src/index.ts"));
const coreCount = TOOLS.length;
const opCount = TOOLS.reduce((s, t) => s + t.ops.length, 0);
const clientCount = appCount - coreCount;

// Each entry: file path (relative to repo root), the expected count, and an array
// of regexes that must each match the CORRECT count in the file.
// The patterns are specific enough to avoid false positives on adjacent numbers.
//
// Entries with no explicit `count` field use `appCount` (44) as the expected value.
// Entries with an explicit `count` field use that value instead.
const DOC_CHECKS = [
  // ── appCount (44) guards ────────────────────────────────────────────────────
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
    // Matches: "The 45 apps have divergent"
    //          "reads all 45 of these files"
    patterns: [
      /The\s+(\d+)\s+apps\s+have\s+divergent/,
      /reads\s+all\s+(\d+)\s+of\s+these\s+files/,
    ],
  },
  // ── coreCount (17) guards — authoritative: TOOLS.length ────────────────────
  {
    file: "README.md",
    count: coreCount,
    // Matches: "17 tool categories (25 ops)"
    patterns: [/(\d+)\s+tool\s+categories/],
  },
  {
    file: "CONTRIBUTING.md",
    count: coreCount,
    // Matches: "# @junkyard/core - 17 pure-logic headless tools"
    patterns: [/(\d+)\s+pure-logic\s+headless\s+tools/],
  },
  {
    file: "docs/ARCHITECTURE.md",
    count: coreCount,
    // Matches: "contains 17 headless, pure-logic tool implementations"
    patterns: [/(\d+)\s+headless,\s+pure-logic\s+tool\s+implementations/],
  },
  // ── opCount (25) guards — authoritative: Σ TOOLS[i].ops.length ─────────────
  {
    file: "README.md",
    count: opCount,
    // Matches: "(25 ops)"
    patterns: [/\((\d+)\s+ops\)/],
  },
  // ── clientCount (27) guards — authoritative: appCount − coreCount ───────────
  {
    file: "docs/ARCHITECTURE.md",
    count: clientCount,
    // Matches: "The remaining 27 tools are browser-only"
    patterns: [/remaining\s+(\d+)\s+tools/],
  },
];

let errors = [];

for (const { file, count: expectedCount = appCount, patterns } of DOC_CHECKS) {
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
    if (stated !== expectedCount) {
      errors.push(
        `${file}: doc states ${stated} but expected ${expectedCount} — update the prose to match`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error(
    `doc-count guard FAILED (appCount=${appCount}, coreCount=${coreCount}, opCount=${opCount}, clientCount=${clientCount}):`,
  );
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `doc-count guard OK — appCount=${appCount}, coreCount=${coreCount}, opCount=${opCount}, clientCount=${clientCount}`,
);
