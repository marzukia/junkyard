/**
 * Audio transcription using @huggingface/transformers with Whisper.
 *
 * Model loading and inference run in infer.worker.ts (web worker).
 * This file only contains types and constants used by the main thread.
 */

// whisper-base: ~145 MB, good accuracy, English + multilingual
// whisper-tiny.en: ~75 MB, English only, fastest
export const MODEL_ID = "onnx-community/whisper-base";

export const MODEL_SIZE_MB = 145;

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

export interface TranscriptChunk {
  start: number;
  end: number | null;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  chunks: TranscriptChunk[];
}

export interface TranscribeFileOptions {
  language?: string;
  /** When true, requests Whisper's translation task (output always English). */
  translateToEnglish?: boolean;
  /** Called each time a chunk is decoded; chunksProcessed increments. */
  onChunk?: (chunksProcessed: number) => void;
}