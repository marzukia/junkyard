/**
 * Generate a timestamped export filename for the collage.
 * Format: collage-YYYYMMDD-HHmmss.png (or .jpg)
 */
export function exportFilename(format: "png" | "jpg"): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `collage-${date}.${format}`;
}
