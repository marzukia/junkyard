import type { ResumeData } from "../store/useResumeStore";

/**
 * Serialise the resume store data to a JSON string in our internal format.
 * This is a lossless round-trip: importing the file restores the exact same state.
 */
export function exportResumeJson(data: ResumeData): string {
  // Strip action functions – data is already a plain object shape
  return JSON.stringify(data, null, 2);
}

/** Trigger a browser download of the JSON string as filename.json */
export function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
