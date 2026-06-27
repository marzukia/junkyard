/**
 * Web Worker for transcribe: runs model load + inference off the main thread.
 * The File object is cloned (structured clone) into the worker.
 * decodeAudioFile uses OfflineAudioContext which is available in workers.
 */
import { env, pipeline } from "@huggingface/transformers";
import type { WorkerMsg, WorkerRequest } from "@junkyardsh/ui";
import type { TranscriptionResult, TranscriptChunk } from "./lib/transcription";
import { MODEL_ID } from "./lib/transcription";

// ── Disable multi-threaded WASM (requires SharedArrayBuffer / COOP+COEP) ──────
// Must be set BEFORE any InferenceSession is created.
(env.backends as unknown as { onnx: { wasm: { numThreads: number } } }).onnx.wasm.numThreads = 1;

// Use browser cache so subsequent visits skip the download.
env.useBrowserCache = true;

type TransformersProgressEvent = { status: string; loaded?: number; total?: number };

// Whisper chunk result shape from transformers.js
interface WhisperChunk {
  timestamp: [number, number | null];
  text: string;
}

interface WhisperOutput {
  text: string;
  chunks?: WhisperChunk[];
}

type AutomaticSpeechRecognitionPipeline = (
  audio: Float32Array | string,
  options?: Record<string, unknown>
) => Promise<WhisperOutput>;

let asr: AutomaticSpeechRecognitionPipeline | null = null;

async function loadModel(onProgress?: (loaded: number, total: number, status: string) => void): Promise<void> {
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

function isModelLoaded(): boolean {
  return asr !== null;
}

async function decodeAudioFile(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, 1, 16000);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

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

async function transcribeFile(
  file: File,
  onProgress?: (loaded: number, total: number, status: string) => void,
  language?: string,
  options?: { translateToEnglish?: boolean; onChunk?: (n: number) => void }
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
    task: translateToEnglish ? "translate" : "transcribe",
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

type Args = {
  file: File;
  language?: string;
  translateToEnglish: boolean;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { file, language, translateToEnglish } = e.data.args;

  try {
    if (!isModelLoaded()) {
      await loadModel((loaded, total, status) => {
        const msg: WorkerMsg<TranscriptionResult> = { type: "progress", loaded, total, status };
        self.postMessage(msg);
      });
    }

    // Signal that audio decode is starting (runs inside transcribeFile before inference)
    self.postMessage({
      type: "progress",
      loaded: 0,
      total: 1,
      status: "decoding",
    } as WorkerMsg<TranscriptionResult>);

    let chunksProcessed = 0;
    const result = await transcribeFile(
      file,
      undefined,
      language !== "auto" ? language : undefined,
      {
        translateToEnglish,
        onChunk: (n) => {
          chunksProcessed = n;
          const msg: WorkerMsg<TranscriptionResult> = {
            type: "chunk_progress",
            done: chunksProcessed,
            total: chunksProcessed + 1,
          };
          self.postMessage(msg);
        },
      }
    );

    const msg: WorkerMsg<TranscriptionResult> = { type: "result", payload: result };
    self.postMessage(msg);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during transcription.";
    const msg: WorkerMsg<TranscriptionResult> = { type: "error", message };
    self.postMessage(msg);
  }
};