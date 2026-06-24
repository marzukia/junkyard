// Shared utilities for umami-ids.txt parsing.
// Single canonical implementation used by inject-umami.mjs and check-umami-present.mjs.

/** Loose UUID validator: 8-4-4-4-12 hex groups */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse the contents of umami-ids.txt.
 * Format: <slug> <uuid>  (one per line; blank lines and # comments ignored)
 * Returns Map<slug, uuid>.
 */
export function parseUmamiIds(rawText) {
  const map = new Map();
  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;
    map.set(parts[0], parts[1]);
  }
  return map;
}
