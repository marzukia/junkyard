/**
 * Pure image-manipulation helpers, no DOM side-effects, easily unit-tested.
 */

/** Supported input image MIME types. */
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type AcceptedType = (typeof ACCEPTED_TYPES)[number];

/** True if the file's MIME type is a supported raster image. */
export function isSupportedImage(file: File): boolean {
  return (ACCEPTED_TYPES as readonly string[]).includes(file.type);
}

export { formatBytes } from "@junkyardsh/ui";
export { formatProgress } from "@junkyardsh/ui/ai";

/** Produce a safe download filename for the depth map output. */
export function outputFilename(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/, "");
  return `${base}-depth.png`;
}
