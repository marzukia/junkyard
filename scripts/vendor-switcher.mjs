#!/usr/bin/env node
/**
 * vendor-switcher.mjs
 *
 * For each apps/<slug>/:
 *   1. Finds the file containing className="utility-bar".
 *   2. Copies AppSwitcher.tsx and AppSwitcher.css into the same directory.
 *   3. Injects the import and <AppSwitcher /> element idempotently.
 *
 * Run from repo root: node scripts/vendor-switcher.mjs
 * Safe to re-run (idempotent).
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const KIT_DIR = join(REPO_ROOT, "kit", "components");

const SWITCHER_TSX = join(KIT_DIR, "AppSwitcher.tsx");
const SWITCHER_CSS = join(KIT_DIR, "AppSwitcher.css");

// Recursively find all .tsx files under a directory
function findTsx(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsx(full));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

// Find the one src/**/*.tsx file that contains className="utility-bar"
function findUtilityBarFile(slug) {
  const srcDir = join(APPS_DIR, slug, "src");
  const txsFiles = findTsx(srcDir);
  const matches = txsFiles.filter((f) =>
    readFileSync(f, "utf8").includes('className="utility-bar"'),
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(`  [WARN] ${slug}: multiple utility-bar files found, using first: ${matches[0]}`);
  }
  return matches[0];
}

// Insert AppSwitcher import after the last import line in the file
function injectImport(content, importLine) {
  if (content.includes(importLine)) return content; // already present

  // Find last import statement
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("import ")) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx === -1) {
    // No imports found; prepend
    return importLine + "\n" + content;
  }
  lines.splice(lastImportIdx + 1, 0, importLine);
  return lines.join("\n");
}

// Insert <AppSwitcher /> as the first child inside <div className="utility-bar">
function injectElement(content) {
  const MARKER = "<AppSwitcher />";
  if (content.includes(MARKER)) return content; // already present

  // Match the opening tag and inject MARKER as first child
  // Pattern: <div className="utility-bar">
  // The next content could be whitespace then the existing first child
  const pattern = /(<div\s+className="utility-bar"\s*>)(\s*)/;
  if (!pattern.test(content)) {
    console.warn("  [WARN] Could not find utility-bar div opening tag; skipping element inject");
    return content;
  }

  // Determine indentation from surrounding context
  // Find the line containing the opening tag to derive indent
  const lines = content.split("\n");
  let openLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<div className="utility-bar">')) {
      openLineIdx = i;
      break;
    }
  }

  if (openLineIdx === -1) {
    // Fallback: simple regex replace
    return content.replace(pattern, `$1\n        <AppSwitcher />$2`);
  }

  const openLine = lines[openLineIdx];
  const indent = openLine.match(/^(\s*)/)[1];
  const childIndent = indent + "  ";

  // Insert the AppSwitcher line after the opening tag line
  lines.splice(openLineIdx + 1, 0, `${childIndent}<AppSwitcher />`);
  return lines.join("\n");
}

const slugs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let modifiedCount = 0;
let skippedCount = 0;

for (const slug of slugs) {
  const targetFile = findUtilityBarFile(slug);
  if (!targetFile) {
    console.warn(`[SKIP] ${slug}: no utility-bar file found`);
    skippedCount++;
    continue;
  }

  const targetDir = dirname(targetFile);
  const destTsx = join(targetDir, "AppSwitcher.tsx");
  const destCss = join(targetDir, "AppSwitcher.css");

  // Copy AppSwitcher files into target directory
  copyFileSync(SWITCHER_TSX, destTsx);
  copyFileSync(SWITCHER_CSS, destCss);

  // Determine relative import path for the CSS (the CSS import is in AppSwitcher.tsx itself,
  // which is now a copy in targetDir - no path change needed since it imports "./AppSwitcher.css")

  // Inject into the target file (Header.tsx or App.tsx)
  const original = readFileSync(targetFile, "utf8");
  const importLine = `import { AppSwitcher } from "./AppSwitcher";`;

  let updated = original;
  updated = injectImport(updated, importLine);
  updated = injectElement(updated);

  if (updated !== original) {
    writeFileSync(targetFile, updated, "utf8");
    console.log(`[MOD] ${slug}: ${targetFile.replace(REPO_ROOT + "/", "")}`);
    modifiedCount++;
  } else {
    console.log(`[OK ] ${slug}: already injected (${targetFile.replace(REPO_ROOT + "/", "")})`);
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${skippedCount} skipped, ${slugs.length} total apps.`);
