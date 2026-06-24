#!/usr/bin/env bun
// Guard: every apps/*/index.html bootstrap <script> block must match the
// canonical from kit/seo/index-template.html exactly.
//
// The bootstrap sets data-mantine-color-scheme before React hydrates to
// prevent FOUC. It shares "mantine-color-scheme-value" + light/dark/auto
// vocabulary with ThemeToggle.tsx — any drift between the 45 copies and
// the canonical means some tools would flash on load.
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;
const templatePath = join(root, "kit", "seo", "index-template.html");
const appsDir = join(root, "apps");

// Extract the bootstrap block from an HTML string.
// Matches the full comment+script section beginning with the no-flash comment.
function extractBootstrap(html, filePath) {
  const m = html.match(
    /<!-- ── No-flash dark-mode script[\s\S]*?<\/script>/
  );
  if (!m) return null;
  return m[0];
}

const templateHtml = readFileSync(templatePath, "utf8");
const canonical = extractBootstrap(templateHtml, templatePath);
if (!canonical) {
  console.error(`check-bootstrap FAILED: could not find bootstrap block in ${templatePath}`);
  process.exit(1);
}

const slugs = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const failures = [];

for (const slug of slugs) {
  const filePath = join(appsDir, slug, "index.html");
  let html;
  try {
    html = readFileSync(filePath, "utf8");
  } catch {
    failures.push(`${slug}: index.html not found`);
    continue;
  }
  const block = extractBootstrap(html, filePath);
  if (block === null) {
    failures.push(`${slug}: no bootstrap block found`);
  } else if (block !== canonical) {
    failures.push(`${slug}: bootstrap diverges from canonical`);
    // Show first differing line for quick diagnosis
    const canonLines = canonical.split("\n");
    const blockLines = block.split("\n");
    for (let i = 0; i < Math.max(canonLines.length, blockLines.length); i++) {
      if (canonLines[i] !== blockLines[i]) {
        console.error(`  ${slug} line ${i + 1}:`);
        console.error(`    canonical: ${JSON.stringify(canonLines[i])}`);
        console.error(`    app:       ${JSON.stringify(blockLines[i])}`);
        break;
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`check-bootstrap FAILED (${failures.length}/${slugs.length} apps diverged):`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}

console.log(`check-bootstrap OK — ${slugs.length} apps match canonical`);
