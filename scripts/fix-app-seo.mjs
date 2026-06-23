/**
 * fix-app-seo.mjs
 *
 * Rewrites per-app SEO metadata from the retired <slug>.mrzk.io subdomain pattern
 * to the canonical path-based URL at https://junkyard.mrzk.io/<slug>/.
 *
 * Files touched per app:
 *   apps/<slug>/index.html          - canonical, og:url, og:image, twitter:image, JSON-LD url
 *   apps/<slug>/public/sitemap.xml  - <loc>
 *   apps/<slug>/public/robots.txt   - Sitemap: line
 *
 * Footer "more tools" links (three inline apps embed footer in App.tsx, rest use Footer.tsx):
 *   apps/<slug>/src/components/Footer.tsx  OR  apps/<slug>/src/App.tsx
 *   https://mrzk.io/apps/ -> https://junkyard.mrzk.io/
 *
 * Run: node scripts/fix-app-seo.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { readdirSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const APPS_DIR = resolve(__dirname, "../apps");
const HUB_URL = "https://junkyard.mrzk.io";

// These three apps embed the footer inline in App.tsx instead of using Footer.tsx
const INLINE_FOOTER_APPS = new Set(["colours", "favicon", "subs"]);

const slugs = readdirSync(APPS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let totalFiles = 0;
let totalReplacements = 0;

function patchFile(filePath, patchFn) {
  if (!existsSync(filePath)) return 0;
  const original = readFileSync(filePath, "utf8");
  const patched = patchFn(original);
  if (patched === original) return 0;
  writeFileSync(filePath, patched, "utf8");
  totalFiles++;
  return 1;
}

function countReplacements(before, after) {
  // rough count - count how many lines changed
  const bLines = before.split("\n");
  const aLines = after.split("\n");
  let changed = 0;
  const len = Math.max(bLines.length, aLines.length);
  for (let i = 0; i < len; i++) {
    if (bLines[i] !== aLines[i]) changed++;
  }
  return changed;
}

for (const slug of slugs) {
  const appDir = join(APPS_DIR, slug);
  const oldBase = `https://${slug}.mrzk.io`;
  const newBase = `${HUB_URL}/${slug}`;

  // ── index.html ───────────────────────────────────────────────────────────────
  const indexPath = join(appDir, "index.html");
  patchFile(indexPath, (src) => {
    let out = src;
    // Replace every occurrence of https://<slug>.mrzk.io/ (with trailing slash)
    out = out.replaceAll(`${oldBase}/`, `${newBase}/`);
    // Replace bare https://<slug>.mrzk.io (without trailing slash, unlikely but safe)
    out = out.replaceAll(oldBase, newBase);
    return out;
  });

  // ── public/sitemap.xml ───────────────────────────────────────────────────────
  const sitemapPath = join(appDir, "public", "sitemap.xml");
  patchFile(sitemapPath, (src) => {
    let out = src;
    out = out.replaceAll(`${oldBase}/`, `${newBase}/`);
    out = out.replaceAll(oldBase, newBase);
    return out;
  });

  // ── public/robots.txt ────────────────────────────────────────────────────────
  const robotsPath = join(appDir, "public", "robots.txt");
  patchFile(robotsPath, (src) => {
    let out = src;
    out = out.replaceAll(`${oldBase}/`, `${newBase}/`);
    out = out.replaceAll(oldBase, newBase);
    return out;
  });

  // ── Footer "more tools" link ──────────────────────────────────────────────────
  const footerFile = INLINE_FOOTER_APPS.has(slug)
    ? join(appDir, "src", "App.tsx")
    : join(appDir, "src", "components", "Footer.tsx");

  patchFile(footerFile, (src) =>
    src.replaceAll("https://mrzk.io/apps/", `${HUB_URL}/`)
  );
}

console.log(`Done. Patched ${totalFiles} files across ${slugs.length} apps.`);

// Verification summary
console.log("\nVerification - scanning for residual <slug>.mrzk.io subdomains...");
import { execSync } from "child_process";
const appsRoot = APPS_DIR;
try {
  const result = execSync(
    `grep -rEn 'https://[a-z0-9]+-?[a-z0-9]*\\.mrzk\\.io' ` +
      `${appsRoot}/*/index.html ${appsRoot}/*/public/sitemap.xml ${appsRoot}/*/public/robots.txt 2>/dev/null || true`,
    { encoding: "utf8" }
  );
  const lines = result.trim().split("\n").filter(Boolean);
  const residual = lines.filter(
    (l) => !l.includes("junkyard.mrzk.io") && !l.includes("charted.mrzk.io") && !l.match(/https:\/\/mrzk\.io(?:[^.]|$)/)
  );
  if (residual.length === 0) {
    console.log("PASS: zero residual subdomain occurrences.");
  } else {
    console.error(`FAIL: ${residual.length} residual lines found:`);
    residual.forEach((l) => console.error(" ", l));
    process.exit(1);
  }
} catch (e) {
  console.error("grep error:", e.message);
  process.exit(1);
}
