/**
 * Image helpers for depth estimation — app-specific extensions on the shared core.
 * Shared core (ACCEPTED_TYPES, isSupportedImage, formatBytes, formatProgress)
 * is imported from @junkyardsh/ui.
 */

export {
  ACCEPTED_TYPES,
  type AcceptedType,
  isSupportedImage,
  formatBytes,
  formatProgress,
} from "@junkyardsh/ui";

/** Produce a safe download filename for the depth map output. */
export function outputFilename(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-depth.png`;
}
