/** Produce a safe download filename. Strips extension, appends suffix. */
export function outputFilename(inputName: string, suffix: string, ext?: string): string {
  const base = inputName.replace(/\.([^.]+)$/, "");
  const extension = ext ?? "png";
  return `${base}-${suffix}.${extension}`;
}
