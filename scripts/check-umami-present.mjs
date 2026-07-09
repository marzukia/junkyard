#!/usr/bin/env bun
// Guard: umami-ids.txt must contain a valid UUID.
import { readFileSync } from "fs";
import { join } from "path";
import { UUID_RE, parseUmamiId } from "./umami-ids.mjs";

const root = new URL("../", import.meta.url).pathname;
const idsPath = join(root, "umami-ids.txt");

const raw = readFileSync(idsPath, "utf8");
const uuid = parseUmamiId(raw);

if (!uuid) {
  console.error("umami-present FAILED: no valid UUID found in umami-ids.txt");
  process.exit(1);
}

if (!UUID_RE.test(uuid)) {
  console.error(`umami-present FAILED: invalid UUID "${uuid}"`);
  process.exit(1);
}

console.log(`umami-present OK (website-id: ${uuid})`);
