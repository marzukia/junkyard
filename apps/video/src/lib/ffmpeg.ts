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
import { formatTime, parseTime } from "@junkyardsh/kit";

// CDN base for @ffmpeg/core single-thread build.
// VERSION PAIRING — do not align these independently:
//   @ffmpeg/ffmpeg  0.12.15  (npm, exact-pinned in package.json)
//   @ffmpeg/core    0.12.10  (CDN, loaded here at runtime — NOT bundled)
// The Vite plugin in vite.config.ts patches @ffmpeg/ffmpeg's classes.js for
// the 0.12.15 source specifically. Bumping either version requires reviewing
// the other and updating the patch target if classes.js internals changed.
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

    try {
      await ff.load({
        coreURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`, "application/wasm"),
      });
    } catch (err) {
      // Clear cached promise and instance so the next call can retry the download.
      loadPromise = null;
      ffmpegInstance = null;
      throw err;
    }

    ffmpegInstance = ff;
    return ff;
  })();

  return loadPromise;
}

export async function runFFmpeg(
  inputFile: File | Blob,
  args: string[],
  outputName: string,
  onProgress?: ProgressCallback,
  preArgs?: string[]
): Promise<Blob> {
  const ff = await getFFmpeg();

  const handler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(progress, 1))
    : null;

  // Collect ffmpeg log lines so codec/format errors are surfaced to the caller
  // rather than swallowed into a generic "Processing failed" message.
  const logLines: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message);
  };

  if (handler) ff.on("progress", handler);
  ff.on("log", logHandler);

  const inputName = inputFile instanceof File ? inputFile.name : "clip";
  const inName = `input_${Date.now()}_${inputName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  let bytes: Uint8Array;
  try {
    // Use Blob.arrayBuffer() instead of @ffmpeg/util's fetchFile which relies
    // on FileReader — FileReader can be GC'd mid-read in Chrome, producing
    // a silent "File could not be read! Code=-1" error for Blob inputs.
    const fileData =
      inputFile instanceof Blob
        ? new Uint8Array(await inputFile.arrayBuffer())
        : await fetchFile(inputFile);
    await ff.writeFile(inName, fileData);

    const cmd = preArgs
      ? [...preArgs, "-i", inName, ...args, outputName]
      : ["-i", inName, ...args, outputName];
    const ret = await ff.exec(cmd);
    if (ret !== 0) {
      // Surface the last meaningful ffmpeg log line as the error message so
      // codec/format failures (e.g. unsupported encoder) are diagnosable.
      const detail = logLines
        .filter((l) => l.trim())
        .slice(-3)
        .join(" | ");
      throw new Error(`ffmpeg exited with code ${ret}${detail ? `: ${detail}` : ""}`);
    }

    const data = await ff.readFile(outputName);
    // readFile returns Uint8Array | string; copy into a plain Uint8Array for Blob
    bytes =
      data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string);

    // Clean up to avoid accumulating files in the virtual FS
    await ff.deleteFile(inName).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});
  } finally {
    if (handler) ff.off("progress", handler);
    ff.off("log", logHandler);
  }

  return new Blob([bytes!.buffer as ArrayBuffer], { type: mimeForName(outputName) });
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
/**
 * Format a byte count as a human-readable string (B / KB / MB / GB).
 * Kept local because kit's formatBytes stops at MB — video needs GB support.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Re-exported from @junkyardsh/kit for backward compat.
 * Verified byte-for-byte identical to the removed local implementations
 * (see kit/lib/imageHelpers.ts:57-74). Same edge-case handling:
 * parseTime returns 0 for invalid input, formatTime does not zero-pad hours.
 */
export { formatTime, parseTime } from "@junkyardsh/kit";
