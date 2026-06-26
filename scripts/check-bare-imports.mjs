#!/usr/bin/env node
/**
 * CI guard: scan all built JS bundles for static bare import specifiers.
 *
 * Vite/Rollup should resolve bare imports (e.g. import from "react") into
 * inlined code or relative URLs during production builds. If a bare import
 * survives into the output, the browser will throw:
 *   "Failed to resolve module specifier"  →  blank page.
 *
 * Only checks STATIC imports (import X from "pkg"). Dynamic imports
 * (import("pkg")) are intentionally left as bare in many apps — they
 * resolve at runtime from CDN (e.g. @huggingface/transformers in AI
 * workers, @pdf-lib/fontkit in PDF utilities).
 *
 * Usage:  node scripts/check-bare-imports.mjs
 * Exit:   0 = clean,  1 = bare static imports found
 *
 * Matches patterns like:
 *   import Lp from"@pdf-lib/fontkit"        // no space between from and "
 *   import { x } from "bare-pkg"            // standard form
 *
 * OK (ignored):
 *   import("./relative.js")                 // relative
 *   import("/absolute.js")                  // absolute
 *   import("https://cdn.example.com/...")   // CDN URL
 *   import("bare-pkg")                      // dynamic import — intentional runtime dep
 *
 * Package names may contain / (e.g. @scope/pkg) — these ARE bare imports
 * that must be resolved by the bundler.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;

// A bare import specifier starts with a letter, _, @, or digit (not . / " ').
// It may contain letters, digits, @, _, -, /, or % (for escape sequences).
// It ends with a letter, digit, @, _, or % (not - or /).
const SPECIFIER = /[a-zA-Z_@\d][a-zA-Z\d@_\-/%]*[a-zA-Z\d@_%]/;

// Matches import statements where the specifier is a bare package name.
// Handles both `from "pkg"` and `from"pkg"` (no space).
const BARE_STATIC_RE = new RegExp(
  `import\\s+(?:[\\s\\S]*?)\\s+from\\s*["'](${SPECIFIER.source})["']`,
  "g"
);

let foundAny = false;

function scanFile(filePath) {
  const ext = extname(filePath);
  if (ext !== ".js" && ext !== ".mjs") return;

  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Static imports: import X from "pkg" / import X from"pkg"
    BARE_STATIC_RE.last = 0;
    let m;
    while ((m = BARE_STATIC_RE.exec(line)) !== null) {
      const specifier = m[1];
      // Skip URLs and relative/absolute paths
      if (specifier.startsWith("http://") || specifier.startsWith("https://")) continue;
      if (specifier.startsWith("/")) continue;
      if (specifier.startsWith("./") || specifier.startsWith("../")) continue;

      console.error(`[bare-import] ${filePath}:${i + 1}: bare import "${specifier}"`);
      foundAny = true;
    }

    // Dynamic imports (import("pkg")) are intentionally left as bare in many apps.
    // They resolve at runtime from CDN (e.g. @huggingface/transformers in AI workers,
    // @pdf-lib/fontkit in PDF utils). Only static imports need bundler resolution.
  }
}

function walkDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

// Walk the dist directory
try {
  walkDir(DIST);
} catch (err) {
  // dist/ might not exist during CI verify-only steps (before build)
  if (err.code === "ENOENT") {
    console.log("[bare-import] dist/ not found — skipping (no build yet)");
    process.exit(0);
  }
  throw err;
}

if (foundAny) {
  console.error(
    "\n[bare-import] FAILED: bare import specifiers found in built bundles."
  );
  console.error(
    "These will cause browsers to throw 'Failed to resolve module specifier'"
  );
  console.error(
    "and render the app blank. Fix by adding affected packages to"
  );
  console.error(
    "build.rollupOptions.noExternal in vite.config.ts.\n"
  );
  process.exit(1);
}

console.log("[bare-import] OK — no bare import specifiers in dist/");
process.exit(0);
