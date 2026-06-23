/**
 * Audio transcription using @huggingface/transformers with Whisper.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session, this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required for WebGPU); WASM single-thread is the fallback.
 */
import { env, pipeline } from "@huggingface/transformers";

// ── Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP) ──────
// Must be set BEFORE any InferenceSession is created.
(env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;

// Use browser cache so subsequent visits skip the download.
env.useBrowserCache = true;

// whisper-base: ~145 MB, good accuracy, English + multilingual
// whisper-tiny.en: ~75 MB, English only, fastest
const MODEL_ID = "onnx-community/whisper-base";

export const MODEL_SIZE_MB = 145;

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
};

// Whisper chunk result shape from transformers.js
interface WhisperChunk {
  timestamp: [number, number | null];
  text: string;
}

interface WhisperOutput {
  text: string;
  chunks?: WhisperChunk[];
}

// The pipeline() return type is a wide union, we use unknown cast to stay type-safe
// while avoiding the overly-broad `any`.
type AutomaticSpeechRecognitionPipeline = (
  audio: Float32Array | string,
  options?: Record<string, unknown>
) => Promise<WhisperOutput>;

let asr: AutomaticSpeechRecognitionPipeline | null = null;

/** Load (or return cached) the ASR pipeline. */
export async function loadModel(onProgress?: ProgressCallback): Promise<void> {
  if (asr) return;

  const progressCb = (event: TransformersProgressEvent) => {
    if (!onProgress) return;
    if (event.status === "progress" || event.status === "download") {
      onProgress(event.loaded ?? 0, event.total ?? 1, event.status);
    } else if (event.status === "initiate") {
      onProgress(0, 1, "initiate");
    } else if (event.status === "done") {
      onProgress(1, 1, "done");
    }
  };

  asr = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("automatic-speech-recognition", MODEL_ID, {
    progress_callback: progressCb,
  })) as AutomaticSpeechRecognitionPipeline;
}

export interface TranscriptChunk {
  start: number;
  end: number | null;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptChunk[];
}

/**
 * Decode an audio/video File to a Float32Array at 16 kHz (Whisper's expected sample rate).
 * Uses the Web Audio API's offline decoder, no media element, no playback.
 */
async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, 1, 16000);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  // Resample to 16 kHz via OfflineAudioContext
  const targetSampleRate = 16000;
  const duration = decoded.duration;
  const frameCount = Math.ceil(duration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(1, frameCount, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start();

  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0);
}

export interface TranscribeFileOptions {
  language?: string;
  /** When true, requests Whisper's translation task (output always English). */
  translateToEnglish?: boolean;
  /** Called each time a chunk is decoded; chunksProcessed increments. */
  onChunk?: (chunksProcessed: number) => void;
}

/** Transcribe an audio/video file. Returns full text plus timestamped chunks. */
export async function transcribeFile(
  file: File,
  onProgress?: ProgressCallback,
  language?: string,
  options?: TranscribeFileOptions
): Promise<TranscriptionResult> {
  if (!asr) throw new Error("Model not loaded, call loadModel() first.");

  const audioData = await decodeAudioFile(file);
  const translateToEnglish = options?.translateToEnglish ?? false;
  const onChunk = options?.onChunk;
  let chunksProcessed = 0;

  const output = await asr(audioData, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
    // "translate" task forces English output regardless of source language.
    task: translateToEnglish ? "translate" : "transcribe",
    // Pass language only when the user has specified one (not auto-detect).
    ...(language && language !== "auto" ? { language } : {}),
    progress_callback: (event: TransformersProgressEvent) => {
      if (event.status === "progress") {
        chunksProcessed += 1;
        onChunk?.(chunksProcessed);
        onProgress?.(event.loaded ?? 0, event.total ?? 1, "transcribing");
      }
    },
  });

  const chunks: TranscriptChunk[] = (output.chunks ?? []).map((c) => ({
    start: c.timestamp[0],
    end: c.timestamp[1],
    text: c.text.trim(),
  }));

  return {
    text: output.text.trim(),
    chunks,
  };
}

/** True if the model is already loaded (cached). */
export function isModelLoaded(): boolean {
  return asr !== null;
}
