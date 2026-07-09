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
import { toBlobURL } from "@ffmpeg/util";

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
    const fileData = new Uint8Array(await inputFile.arrayBuffer());
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
 * Splice multiple video clips into a single output.
 * Uses FFmpeg concat demuxer for lossless concatenation (same codec/resolution).
 * Falls back to re-encoding if clips have mismatched properties.
 *
 * @param clips - Array of File objects in desired output order
 * @param outputName - Output filename (e.g. "combined.mp4")
 * @param onProgress - Optional progress callback (0-1)
 * @param forceReencode - Force re-encoding even if clips match (slower but compatible)
 */
export async function spliceVideos(
  clips: File[],
  outputName: string,
  onProgress?: ProgressCallback,
  forceReencode: boolean = false
): Promise<Blob> {
  if (clips.length === 0) {
    throw new Error("No clips provided for splicing");
  }
  if (clips.length === 1) {
    // Single clip — just return it as-is
    return new Blob([await clips[0].arrayBuffer()], { type: mimeForName(outputName) });
  }

  const ff = await getFFmpeg();

  const logLines: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logLines.push(message);
  };
  ff.on("log", logHandler);

  const handler = onProgress
    ? ({ progress }: { progress: number }) => onProgress(Math.min(progress, 1))
    : null;
  if (handler) ff.on("progress", handler);

  // Declare variables outside try block for finally access
  const clipNames: string[] = [];
  const concatListPath = "concat_list.txt";

  try {
    // Write all clips to FFmpeg's virtual FS
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const name = `clip_${i}_${clip.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      clipNames.push(name);
      const data = new Uint8Array(await clip.arrayBuffer());
      await ff.writeFile(name, data);
    }

    // Create concat list file
    const concatContent = clipNames.map((name) => `file '${name}'`).join("\n");
    await ff.writeFile(concatListPath, new TextEncoder().encode(concatContent));

    // Detect if re-encoding is needed (different codecs/resolutions)
    let needsReencode = forceReencode;
    if (!needsReencode) {
      try {
        // Probe first clip to get baseline properties
        await ff.exec(["-i", clipNames[0], "-f", "null", "-"]);
        const probeLog = logLines.join("\n");
        const firstResolution = probeLog.match(/Stream.*Video.*(\d+x\d+)/)?.[1];
        const firstCodec = probeLog.match(/Video: (\w+)/)?.[1];

        // Probe remaining clips
        for (let i = 1; i < clipNames.length; i++) {
          logLines.length = 0; // Clear logs for this probe
          await ff.exec(["-i", clipNames[i], "-f", "null", "-"]);
          const currentLog = logLines.join("\n");
          const currentResolution = currentLog.match(/Stream.*Video.*(\d+x\d+)/)?.[1];
          const currentCodec = currentLog.match(/Video: (\w+)/)?.[1];

          if (
            firstResolution !== currentResolution ||
            firstCodec !== currentCodec
          ) {
            needsReencode = true;
            break;
          }
        }
      } catch {
        // If probing fails, assume re-encode is needed
        needsReencode = true;
      }
    }

    let ret: number;
    if (needsReencode) {
      // Re-encode mode: use filter_complex concat
      // Build filter_complex string: [0:v][0:a][1:v][1:a]...concat=n=2:v=1:a=1[outv][outa]
      const filterParts: string[] = [];
      for (let i = 0; i < clipNames.length; i++) {
        filterParts.push(`[${i}:v]`);
        filterParts.push(`[${i}:a]`);
      }
      const filterComplex = `${filterParts.join("")}concat=n=${clipNames.length}:v=1:a=1[outv][outa]`;

      const args = [
        ...clipNames.map(() => "-i"),
        ...clipNames,
        "-filter_complex",
        filterComplex,
        "-map",
        "[outv]",
        "-map",
        "[outa]",
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        outputName,
      ];

      ret = await ff.exec(args);
    } else {
      // Fast concat mode: lossless, no re-encoding
      ret = await ff.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        outputName,
      ]);
    }

    if (ret !== 0) {
      const detail = logLines
        .filter((l) => l.trim())
        .slice(-3)
        .join(" | ");
      throw new Error(`ffmpeg splice failed with code ${ret}${detail ? `: ${detail}` : ""}`);
    }

    const data = await ff.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? new Uint8Array(data) : new TextEncoder().encode(data as string);

    return new Blob([bytes.buffer as ArrayBuffer], { type: mimeForName(outputName) });
  } finally {
    // Cleanup: delete all clip files and concat list
    for (const name of clipNames) {
      await ff.deleteFile(name).catch(() => {});
    }
    await ff.deleteFile(concatListPath).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});

    if (handler) ff.off("progress", handler);
    ff.off("log", logHandler);
  }
}

/**
 * formatTime and parseTime utilities.
 * Local copies to avoid @junkyardsh/kit import issues.
 * Same implementation as kit/lib/imageHelpers.ts.
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function parseTime(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
