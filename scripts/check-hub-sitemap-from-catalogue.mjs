#!/usr/bin/env bun
// Guard: slugs in hub/public/sitemap.xml must exactly match
// hub/public/catalogue.json slugs + the hub root ("/").
// Fails if any catalogue slug is missing from the sitemap, or if the sitemap
// contains a slug that isn't in the catalogue (and isn't the hub root).
import { readFileSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;

// Parse sitemap.xml for paths like /slug/
const sitemapXml = readFileSync(join(root, "hub", "public", "sitemap.xml"), "utf8");
const locMatches = [...sitemapXml.matchAll(/<loc>https:\/\/junkyard\.sh(\/[^<]*)<\/loc>/g)];
const sitemapPaths = new Set(locMatches.map((m) => m[1]));

// e.g. "/" for root, "/qr/" for qr tool
// Extract slug from path: "/slug/" -> "slug", "/" -> "" (hub root)
const sitemapSlugs = new Set(
  [...sitemapPaths].map((p) => p.replace(/^\/|\/$/g, "")) // strip leading/trailing slash
);

// Parse catalogue.json slugs
const catalogue = JSON.parse(readFileSync(join(root, "hub", "public", "catalogue.json"), "utf8"));
const catalogueSlugs = new Set(catalogue.map((e) => e.slug));

let errors = [];

// Every catalogue slug must appear in sitemap
for (const slug of catalogueSlugs) {
  if (!sitemapSlugs.has(slug)) {
    errors.push(`catalogue slug "${slug}" is missing from hub/public/sitemap.xml`);
  }
}

// Every sitemap slug (non-root) must be in catalogue
for (const slug of sitemapSlugs) {
  if (slug === "") continue; // hub root - always expected
  if (!catalogueSlugs.has(slug)) {
    errors.push(`sitemap entry "/${slug}/" has no matching catalogue entry`);
  }
}

if (errors.length > 0) {
  console.error("hub-sitemap-from-catalogue FAILED:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(`hub-sitemap-from-catalogue OK (${catalogueSlugs.size} catalogue slugs, ${sitemapSlugs.size - 1} sitemap tool entries)`);
