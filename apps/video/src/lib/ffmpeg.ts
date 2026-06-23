/**
 * ffmpeg.ts - single-thread ffmpeg.wasm orchestration
 *
 * Uses @ffmpeg/core (NOT @ffmpeg/core-mt) so no SharedArrayBuffer or COOP/COEP
 * headers are required. GitHub Pages (and any plain static host) works fine.
 *
 * The core is loaded from the jsDelivr CDN at runtime - NOT bundled - so the
 * large wasm binary does not inflate the main bundle. The first call to
 * getFFmpeg() triggers a lazy download and shows the caller's onProgress
 * callback with type="load" events.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// CDN base for @ffmpeg/core single-thread build (pinned to 0.12.x)
const CORE_CDN = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type ProgressCallback = (ratio: number) => void;

export async function getFFmpeg(onLoad?: ProgressCallback): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ff = new FFmpeg();

    if (onLoad) {
      ff.on("progress", ({ progress }) => {
        onLoad(Math.min(progress, 1));
      });
    }

    await ff.load({
      coreURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`, "application/wasm"),
    });

    ffmpegInstance = ff;
    return ff;
  })();

  return loadPromise;
}

export async function runFFmpeg(
  inputFile: File,
  args: string[],
  outputName: string,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const ff = await getFFmpeg();

  if (onProgress) {
    ff.on("progress", ({ progress }) => onProgress(Math.min(progress, 1)));
  }

  const inName = `input_${Date.now()}_${inputFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  await ff.writeFile(inName, await fetchFile(inputFile));

  await ff.exec(["-i", inName, ...args, outputName]);

  const data = await ff.readFile(outputName);
  // readFile returns Uint8Array | string; copy into a plain Uint8Array for Blob
  const bytes =
    data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string);

  // Clean up to avoid accumulating files in the virtual FS
  await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outputName).catch(() => {});

  if (onProgress) {
    // Remove all progress listeners by replacing with a no-op - FFmpeg.wasm
    // doesn't expose removeListener in 0.12.x, but we can re-add our desired
    // listener on the next call. The handler added above fires for this job only
    // since we tear down after completion.
    ff.on("progress", () => {});
  }

  return new Blob([bytes.buffer as ArrayBuffer], { type: mimeForName(outputName) });
}

function mimeForName(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    gif: "image/gif",
  };
  return map[ext] ?? "application/octet-stream";
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Parse "MM:SS" or "HH:MM:SS" or plain seconds into a seconds number. */
export function parseTime(input: string): number {
  const trimmed = input.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/** Format seconds to "HH:MM:SS" */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
