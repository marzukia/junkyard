#!/usr/bin/env bun
// Guard: apps with mcp.exposed:true in their junkyard.ts must exactly match
// the tool slugs in @junkyard/core TOOLS (currently 17).
// Fails if the sets diverge in either direction.
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;
const appsDir = join(root, "apps");

// Collect exposed app slugs by reading junkyard.ts source text.
// We grep for `exposed: true` rather than importing (avoids needing app deps).
const slugs = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const exposedApps = new Set();
for (const slug of slugs) {
  const tsPath = join(appsDir, slug, "junkyard.ts");
  let src;
  try {
    src = readFileSync(tsPath, "utf8");
  } catch {
    continue;
  }
  if (/exposed:\s*true/.test(src)) {
    exposedApps.add(slug);
  }
}

// Collect core TOOLS slugs by importing the package source directly.
const { TOOLS } = await import(join(root, "packages/core/src/index.ts"));
const coreSlugs = new Set(TOOLS.map((t) => t.slug));

let errors = [];

for (const slug of exposedApps) {
  if (!coreSlugs.has(slug)) {
    errors.push(`app "${slug}" has mcp.exposed:true but has no entry in @junkyard/core TOOLS`);
  }
}

for (const slug of coreSlugs) {
  if (!exposedApps.has(slug)) {
    errors.push(`core TOOLS has slug "${slug}" but no app has mcp.exposed:true for it`);
  }
}

if (errors.length > 0) {
  console.error(`core-vs-exposed FAILED (exposed apps: ${exposedApps.size}, core tools: ${coreSlugs.size}):`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(`core-vs-exposed OK (${exposedApps.size} exposed apps = ${coreSlugs.size} core tools)`);
