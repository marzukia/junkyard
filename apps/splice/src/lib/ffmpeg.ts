/**
 * FFmpeg utilities for video splicing
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

const CORE_CDN = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFFmpeg(onLoad?: (progress: number) => void): Promise<FFmpeg> {
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
      loadPromise = null;
      ffmpegInstance = null;
      throw err;
    }

    ffmpegInstance = ff;
    return ff;
  })();

  return loadPromise;
}

export async function spliceVideos(
  clips: File[],
  outputName: string,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ff = await getFFmpeg();

  // Write all input files
  for (let i = 0; i < clips.length; i++) {
    const fileData = new Uint8Array(await clips[i].arrayBuffer());
    await ff.writeFile(`input${i}.mp4`, fileData);
  }

  // Create concat list
  const concatList = clips.map((_, i) => `file 'input${i}.mp4'`).join('\n');
  await ff.writeFile('concat.txt', new TextEncoder().encode(concatList));

  // Run ffmpeg concat command
  onProgress?.(0);
  const ret = await ff.exec([
    '-f', 'concat',
    '-safe', '0',
    '-i', 'concat.txt',
    '-c', 'copy',
    outputName
  ]);

  if (ret !== 0) {
    throw new Error('FFmpeg splice failed');
  }

  onProgress?.(0.5);

  // Read output
  const data = await ff.readFile(outputName);
  onProgress?.(1.0);

  // FileData can be string or Uint8Array
  let buffer: ArrayBuffer;
  if (data instanceof Uint8Array) {
    // Ensure we get a regular ArrayBuffer, not SharedArrayBuffer
    buffer = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer;
  } else {
    buffer = new TextEncoder().encode(data as string).buffer as ArrayBuffer;
  }
  
  return new Blob([buffer], { type: 'video/mp4' });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
