// Shared utilities for umami-ids.txt parsing.
// Single canonical implementation used by inject-umami.mjs and check-umami-present.mjs.

/** Loose UUID validator: 8-4-4-4-12 hex groups */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse the single Umami website ID from umami-ids.txt.
 * Format: a single UUID on its own line (blank lines and # comments ignored).
 * Returns the UUID string, or null if not found.
 */
export function parseUmamiId(rawText) {
  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (UUID_RE.test(trimmed)) return trimmed;
  }
  return null;
}
