#!/usr/bin/env node
/**
 * vendor-mobilewarn.mjs
 *
 * For each of the 9 heavy-tagged apps (bg, caption, depth, summarize,
 * transcribe, translate, upscale, chat, video):
 *   1. Copies MobileWarning.tsx and MobileWarning.css into the app's
 *      components directory (where AppSwitcher.tsx lives).
 *   2. Injects the import and <MobileWarning /> element idempotently,
 *      as the first child inside <main className="site-main">.
 *
 * Run from repo root: node scripts/vendor-mobilewarn.mjs
 * Safe to re-run (idempotent).
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const APPS_DIR = join(REPO_ROOT, "apps");
const KIT_DIR = join(REPO_ROOT, "kit", "components");

const SOURCE_TSX = join(KIT_DIR, "MobileWarning.tsx");
const SOURCE_CSS = join(KIT_DIR, "MobileWarning.css");

// Apps that carry a heavy tag and need the warning.
// cleanup is intentionally excluded (tagged `beta` only, CPU-only).
const HEAVY_SLUGS = [
  "bg",
  "caption",
  "depth",
  "summarize",
  "transcribe",
  "translate",
  "upscale",
  "chat",
  "video",
];

// Recursively find all .tsx files under a directory.
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

// Find the App.tsx that contains <main className="site-main">.
function findAppFile(slug) {
  const srcDir = join(APPS_DIR, slug, "src");
  const txsFiles = findTsx(srcDir);
  const matches = txsFiles.filter((f) =>
    readFileSync(f, "utf8").includes('className="site-main"'),
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    console.warn(`  [WARN] ${slug}: multiple site-main files found, using first: ${matches[0]}`);
  }
  return matches[0];
}

// Find the components directory for a given slug (where AppSwitcher.tsx lives).
function findComponentsDir(slug) {
  const srcDir = join(APPS_DIR, slug, "src");
  const txsFiles = findTsx(srcDir);
  const switcherFile = txsFiles.find((f) => f.endsWith("AppSwitcher.tsx"));
  if (!switcherFile) return null;
  return dirname(switcherFile);
}

// Insert MobileWarning import after the last import line in the file.
function injectImport(content, importLine) {
  if (content.includes(importLine)) return content; // already present

  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("import ")) {
      lastImportIdx = i;
    }
  }
  if (lastImportIdx === -1) {
    return importLine + "\n" + content;
  }
  lines.splice(lastImportIdx + 1, 0, importLine);
  return lines.join("\n");
}

// Insert <MobileWarning /> as the first child inside <main className="site-main">.
function injectElement(content) {
  const MARKER = "<MobileWarning />";
  if (content.includes(MARKER)) return content; // already present

  const lines = content.split("\n");
  let openLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<main className="site-main">')) {
      openLineIdx = i;
      break;
    }
  }

  if (openLineIdx === -1) {
    console.warn("  [WARN] Could not find site-main opening tag; skipping element inject");
    return content;
  }

  const openLine = lines[openLineIdx];
  const indent = openLine.match(/^(\s*)/)[1];
  const childIndent = indent + "  ";

  lines.splice(openLineIdx + 1, 0, `${childIndent}<MobileWarning />`);
  return lines.join("\n");
}

let modifiedCount = 0;
let skippedCount = 0;

for (const slug of HEAVY_SLUGS) {
  const componentsDir = findComponentsDir(slug);
  if (!componentsDir) {
    console.warn(`[SKIP] ${slug}: no components dir found`);
    skippedCount++;
    continue;
  }

  const appFile = findAppFile(slug);
  if (!appFile) {
    console.warn(`[SKIP] ${slug}: no site-main file found`);
    skippedCount++;
    continue;
  }

  // Copy MobileWarning files into the app's components directory.
  const destTsx = join(componentsDir, "MobileWarning.tsx");
  const destCss = join(componentsDir, "MobileWarning.css");
  copyFileSync(SOURCE_TSX, destTsx);
  copyFileSync(SOURCE_CSS, destCss);

  // Determine relative import path from appFile to components dir.
  // AppSwitcher is imported as "./components/MobileWarning" in App.tsx.
  const appDir = dirname(appFile);
  const relDir = componentsDir.replace(appDir + "/", "");
  const importLine = `import { MobileWarning } from "./${relDir}/MobileWarning";`;

  const original = readFileSync(appFile, "utf8");
  let updated = original;
  updated = injectImport(updated, importLine);
  updated = injectElement(updated);

  if (updated !== original) {
    writeFileSync(appFile, updated, "utf8");
    console.log(`[MOD] ${slug}: ${appFile.replace(REPO_ROOT + "/", "")}`);
    modifiedCount++;
  } else {
    console.log(`[OK ] ${slug}: already injected (${appFile.replace(REPO_ROOT + "/", "")})`);
  }
}

console.log(`\nDone: ${modifiedCount} modified, ${skippedCount} skipped.`);
