/** FFmpeg loader and utilities. */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise.then(() => ffmpegInstance!);

  loadPromise = (async () => {
    const { FFmpeg: FFmpegClass } = await import("@ffmpeg/ffmpeg");
    ffmpegInstance = new FFmpegClass();

    const logger: Record<"trace" | "debug" | "info" | "warn" | "error", (msg: string) => void> = {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: (msg) => console.warn("[ffmpeg]", msg),
      error: (msg) => console.error("[ffmpeg]", msg),
    };

    ffmpegInstance.on("log", ({ message }: { message: string }) => logger.debug(message));
    ffmpegInstance.on("progress", ({ progress }: { progress: number }) =>
      logger.info(`Progress: ${Math.round(progress * 100)}%`)
    );

    await ffmpegInstance.load({
      coreURL: `${CDN_BASE}/ffmpeg-core.js`,
      wasmURL: `${CDN_BASE}/ffmpeg-core.wasm`,
      workerURL: `${CDN_BASE}/ffmpeg-core.worker.js`,
    });
  })();

  await loadPromise;
  return ffmpegInstance!;
}

export async function convertAudio(
  ffmpeg: FFmpeg,
  inputBlob: Blob,
  inputName: string,
  outputFormat: string,
  bitrate: number | null,
  sampleRate: number | "original",
  mono: boolean
): Promise<Blob> {
  const outputName = `converted.${outputFormat}`;

  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

  let args = ["-i", inputName];

  if (sampleRate !== "original") {
    args.push("-ar", sampleRate.toString());
  }

  if (mono) {
    args.push("-ac", "1");
  }

  if (bitrate) {
    args.push("-b:a", `${bitrate}k`);
  }

  args.push(outputName);

  await ffmpeg.exec(args);
  const data = await ffmpeg.readFile(outputName);

  let buffer: ArrayBuffer;
  if (data instanceof Uint8Array) {
    buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  } else {
    buffer = new TextEncoder().encode(data as string).buffer as ArrayBuffer;
  }

  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    flac: "audio/flac",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    opus: "audio/opus",
    aiff: "audio/aiff",
  };

  return new Blob([buffer], { type: mimeTypes[outputFormat] || "application/octet-stream" });
}