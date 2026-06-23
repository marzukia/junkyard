#!/usr/bin/env bun
// Guard: every apps/<slug>/public/sitemap.xml and robots.txt must exist,
// plus hub/public/sitemap.xml.
import { readdirSync, existsSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;
const appsDir = join(root, "apps");

const slugs = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let missing = [];

for (const slug of slugs) {
  const sitemap = join(appsDir, slug, "public", "sitemap.xml");
  const robots = join(appsDir, slug, "public", "robots.txt");
  if (!existsSync(sitemap)) missing.push(`apps/${slug}/public/sitemap.xml`);
  if (!existsSync(robots)) missing.push(`apps/${slug}/public/robots.txt`);
}

const hubSitemap = join(root, "hub", "public", "sitemap.xml");
if (!existsSync(hubSitemap)) missing.push("hub/public/sitemap.xml");

if (missing.length > 0) {
  console.error("sitemap-exists FAILED - missing files:");
  for (const f of missing) console.error("  " + f);
  process.exit(1);
}

console.log(`sitemap-exists OK (${slugs.length} apps checked)`);
