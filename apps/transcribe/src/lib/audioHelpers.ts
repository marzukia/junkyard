/**
 * Pure audio/file helpers, no DOM side-effects, easily unit-tested.
 */

/** Supported audio/video MIME types for transcription. */
export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "audio/aac",
  "audio/x-m4a",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
] as const;

export type AcceptedAudioType = (typeof ACCEPTED_AUDIO_TYPES)[number];

/** True if the file's MIME type is a supported audio or video file. */
export function isSupportedAudio(file: File): boolean {
  // Check MIME type first
  if ((ACCEPTED_AUDIO_TYPES as readonly string[]).includes(file.type)) return true;
  // Fall back to extension check for files with generic MIME (e.g. application/octet-stream)
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp3", "mp4", "m4a", "ogg", "wav", "webm", "flac", "aac", "mov"].includes(ext);
}

export { formatBytes } from "@junkyardsh/ui";

/** Format a download progress fraction as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}

/**
 * Format seconds as MM:SS or H:MM:SS.
 * e.g. 65.3 -> "1:05", 3665 -> "1:01:05"
 */
export function formatTimestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** HTML accept attribute string for the file input. */
export const ACCEPT_ATTR =
  "audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,audio/flac,audio/aac,audio/x-m4a,video/mp4,video/webm,video/ogg,video/quicktime,.mp3,.mp4,.m4a,.ogg,.wav,.webm,.flac,.aac,.mov";

/**
 * Format timestamped chunks as SRT subtitle text.
 * Chunks without an end time use start + 2 s as a fallback.
 */
export function formatSRT(
  chunks: Array<{ start: number; end: number | null; text: string }>
): string {
  return chunks
    .map((chunk, i) => {
      const end = chunk.end ?? chunk.start + 2;
      return `${i + 1}\n${toSRTTime(chunk.start)} --> ${toSRTTime(end)}\n${chunk.text.trim()}`;
    })
    .join("\n\n");
}

/**
 * Format timestamped chunks as WebVTT subtitle text.
 * Chunks without an end time use start + 2 s as a fallback.
 */
export function formatVTT(
  chunks: Array<{ start: number; end: number | null; text: string }>
): string {
  const body = chunks
    .map((chunk) => {
      const end = chunk.end ?? chunk.start + 2;
      return `${toVTTTime(chunk.start)} --> ${toVTTTime(end)}\n${chunk.text.trim()}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}`;
}

/** Seconds to SRT time format: HH:MM:SS,mmm */
function toSRTTime(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** Seconds to WebVTT time format: HH:MM:SS.mmm */
function toVTTTime(seconds: number): string {
  return toSRTTime(seconds).replace(",", ".");
}

/** Trigger a browser file download with the given filename and text content. */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Format timestamped chunks as a JSON transcript.
 * Shape: { text: string, chunks: Array<{start,end,text}> }
 */
export function formatJSON(
  fullText: string,
  chunks: Array<{ start: number; end: number | null; text: string }>
): string {
  return JSON.stringify({ text: fullText, chunks }, null, 2);
}

/**
 * Format elapsed seconds as a human-readable string.
 * e.g. 65 -> "1:05", 4 -> "0:04"
 */
export function formatElapsed(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
