/**
 * Canvas aspect ratio presets.
 * ratio = width / height
 */

export interface AspectPreset {
  id: string;
  label: string;
  ratio: number;
  /** Canonical export resolution at this aspect (width px) — 2400px tall max */
  exportWidth: number;
  exportHeight: number;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "1:1", label: "1:1", ratio: 1, exportWidth: 2400, exportHeight: 2400 },
  { id: "4:5", label: "4:5", ratio: 4 / 5, exportWidth: 1920, exportHeight: 2400 },
  { id: "9:16", label: "9:16", ratio: 9 / 16, exportWidth: 1350, exportHeight: 2400 },
  { id: "3:2", label: "3:2", ratio: 3 / 2, exportWidth: 2400, exportHeight: 1600 },
  { id: "16:9", label: "16:9", ratio: 16 / 9, exportWidth: 2400, exportHeight: 1350 },
  // Social output presets
  { id: "ig-square", label: "IG Square", ratio: 1, exportWidth: 1080, exportHeight: 1080 },
  { id: "ig-portrait", label: "IG Portrait", ratio: 4 / 5, exportWidth: 1080, exportHeight: 1350 },
  { id: "ig-story", label: "IG Story", ratio: 9 / 16, exportWidth: 1080, exportHeight: 1920 },
  {
    id: "pinterest",
    label: "Pinterest",
    ratio: 1000 / 1500,
    exportWidth: 1000,
    exportHeight: 1500,
  },
];

export function getAspectPreset(id: string): AspectPreset | undefined {
  return ASPECT_PRESETS.find((p) => p.id === id);
}

/** Returns { width, height } CSS for the canvas preview given a container width. */
export function canvasPreviewSize(
  ratio: number,
  containerWidth: number,
  containerHeight: number
): { width: number; height: number } {
  const byWidth = { width: containerWidth, height: containerWidth / ratio };
  const byHeight = { width: containerHeight * ratio, height: containerHeight };
  // Fit inside the container (letterbox)
  if (byWidth.height <= containerHeight) return byWidth;
  return byHeight;
}
