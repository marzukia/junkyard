#!/usr/bin/env node
// inject-umami.mjs
// Reads scripts/umami.config.json (host) and umami-ids.txt (slug -> uuid map),
// then injects the Umami analytics script tag into each dist/<slug>/index.html.
// Skips slugs with no id (warns), validates UUID format, and is idempotent.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load config
const config = JSON.parse(
  readFileSync(join(__dirname, "umami.config.json"), "utf8")
);
const { host } = config;

// Parse umami-ids.txt
// Format: <slug> <uuid>  (one per line; blank lines and # comments ignored)
const idsRaw = readFileSync(join(ROOT, "umami-ids.txt"), "utf8");
const slugMap = new Map();
for (const line of idsRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) continue;
  slugMap.set(parts[0], parts[1]);
}

// Loose UUID validator: 8-4-4-4-12 hex groups
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIST = join(ROOT, "dist");
if (!existsSync(DIST)) {
  console.error("[umami] dist/ does not exist - run build first");
  process.exit(1);
}

let injected = 0;
let skipped = 0;
let alreadyPresent = 0;

const slugDirs = readdirSync(DIST, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

for (const slug of slugDirs) {
  const htmlPath = join(DIST, slug, "index.html");
  if (!existsSync(htmlPath)) continue;

  if (!slugMap.has(slug)) {
    console.warn(`[umami] no website-id for ${slug}, skipping`);
    skipped++;
    continue;
  }

  const uuid = slugMap.get(slug);
  if (!UUID_RE.test(uuid)) {
    console.warn(`[umami] invalid UUID for ${slug} ("${uuid}"), skipping`);
    skipped++;
    continue;
  }

  const html = readFileSync(htmlPath, "utf8");

  // Idempotency: skip if this host's script is already present
  if (html.includes(`https://${host}/script.js`)) {
    alreadyPresent++;
    continue;
  }

  const tag = `\n    <script defer src="https://${host}/script.js" data-website-id="${uuid}"></script>`;
  const patched = html.replace("</head>", `${tag}\n  </head>`);

  if (patched === html) {
    console.warn(`[umami] </head> not found in ${slug}/index.html, skipping`);
    skipped++;
    continue;
  }

  writeFileSync(htmlPath, patched, "utf8");
  injected++;
}

console.log(
  `[umami] done: injected=${injected} already-present=${alreadyPresent} skipped=${skipped}`
);
