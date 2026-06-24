/**
 * format.ts -- canonical shared formatting helpers.
 *
 * Vendored into each app's src/lib/ via scripts/vendor-format.mjs.
 * Edit here, then run: node scripts/vendor-format.mjs
 */

/** Format a byte count as a human-readable string (B / KB / MB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
