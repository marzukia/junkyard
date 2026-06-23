#!/usr/bin/env bun
// Guard: every app slug (except video and cleanup) must appear in umami-ids.txt
// with a valid UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const root = new URL("../", import.meta.url).pathname;
const appsDir = join(root, "apps");
const umamiFile = join(root, "umami-ids.txt");

// Known excluded slugs (no Umami id yet, tracked in issue #12)
const EXCLUDED = new Set(["video", "cleanup"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Parse umami-ids.txt -> Map<slug, uuid>
const umamiMap = new Map();
for (const line of readFileSync(umamiFile, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const [slug, uuid] = trimmed.split(/\s+/);
  if (slug && uuid) umamiMap.set(slug, uuid);
}

const slugs = readdirSync(appsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

let errors = [];

for (const slug of slugs) {
  if (EXCLUDED.has(slug)) continue;
  const uuid = umamiMap.get(slug);
  if (!uuid) {
    errors.push(`${slug}: missing from umami-ids.txt`);
  } else if (!UUID_RE.test(uuid)) {
    errors.push(`${slug}: invalid UUID "${uuid}"`);
  }
}

if (errors.length > 0) {
  console.error("umami-present FAILED:");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(`umami-present OK (${slugs.length - EXCLUDED.size} apps checked, ${EXCLUDED.size} excluded)`);
