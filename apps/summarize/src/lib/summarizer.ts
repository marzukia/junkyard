/**
 * Abstractive summarization using @huggingface/transformers with DistilBART CNN 6-6.
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before loading any
 * ONNX session, this routes entirely through the single-threaded WASM backend
 * and never touches SharedArrayBuffer. WebGPU is attempted first (no isolation
 * required); WASM single-thread is the fallback.
 */
import { type SummarizationPipeline, env, pipeline } from "@huggingface/transformers";
import { loadPipeline } from "../../../../kit/lib/workerInference";
import { MODEL_MAX_WORDS, chunkText, countWords } from "./textHelpers";

export const MODEL_ID = "Xenova/distilbart-cnn-6-6";

let summarizer: SummarizationPipeline | null = null;

/** Load (or return cached) the summarization pipeline. */
export async function loadModel(): Promise<void> {
  if (summarizer) return;

  summarizer = await loadPipeline<SummarizationPipeline>(env, async (progressCb) => {
    return (await (
      pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
    )("summarization", MODEL_ID, {
      progress_callback: progressCb,
    })) as SummarizationPipeline;
  });
}

export interface SummaryOptions {
  /** Target minimum word count for the summary. */
  minWords: number;
  /** Target maximum word count for the summary. */
  maxWords: number;
  /** Called after each chunk is processed; (doneChunks, totalChunks). */
  onChunkProgress?: (done: number, total: number) => void;
}

export interface SummaryResult {
  summary: string;
  inputWords: number;
  outputWords: number;
  /** Number of chunks the input was split into (1 = no chunking needed). */
  chunks: number;
}

/** Run the model on a single chunk of text that fits within MODEL_MAX_WORDS. */
async function summarizeChunk(text: string, minLength: number, maxLength: number): Promise<string> {
  if (!summarizer) throw new Error("Model not loaded, call loadModel() first.");

  const output = await (
    summarizer as unknown as (text: string, opts: Record<string, unknown>) => Promise<unknown>
  )(text, {
    min_length: minLength,
    max_length: maxLength,
    do_sample: false,
  });

  const results = Array.isArray(output) ? output : [output];
  const first = results[0];
  return (first as { summary_text: string }).summary_text?.trim() ?? "";
}

/**
 * Summarize text. For long documents (> MODEL_MAX_WORDS), performs a two-pass
 * map-reduce: summarize each chunk individually, then summarize the combined
 * chunk summaries to produce a single coherent summary.
 *
 * Throws if model is not loaded or input is too short.
 */
export async function summarize(text: string, opts: SummaryOptions): Promise<SummaryResult> {
  if (!summarizer) throw new Error("Model not loaded, call loadModel() first.");

  const inputWords = countWords(text);
  if (inputWords < 30) {
    throw new Error("Input is too short. Paste at least 30 words to summarize.");
  }

  // Convert word targets to approximate token targets (1 word ~ 1.3 tokens for DistilBART).
  const minLength = Math.max(10, Math.round(opts.minWords * 1.3));
  const maxLength = Math.max(minLength + 10, Math.round(opts.maxWords * 1.3));

  const chunks = chunkText(text, MODEL_MAX_WORDS);

  if (chunks.length === 1) {
    // Short enough to summarize directly.
    opts.onChunkProgress?.(0, 1);
    const summary = await summarizeChunk(chunks[0], minLength, maxLength);
    opts.onChunkProgress?.(1, 1);
    if (!summary) throw new Error("Summarization returned an empty result.");
    return { summary, inputWords, outputWords: countWords(summary), chunks: 1 };
  }

  // Map pass: summarize each chunk with a compact per-chunk max.
  const chunkMaxLength = Math.max(40, Math.round(maxLength / chunks.length) + 20);
  const chunkMinLength = Math.max(10, Math.round(chunkMaxLength * 0.4));

  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    opts.onChunkProgress?.(i, chunks.length + 1);
    const cs = await summarizeChunk(chunks[i], chunkMinLength, chunkMaxLength);
    if (cs) chunkSummaries.push(cs);
  }

  if (chunkSummaries.length === 0) {
    throw new Error("Summarization returned empty results for all chunks.");
  }

  // Reduce pass: combine chunk summaries and summarize once more.
  opts.onChunkProgress?.(chunks.length, chunks.length + 1);
  const combined = chunkSummaries.join(" ");
  const finalSummary = await summarizeChunk(combined, minLength, maxLength);
  opts.onChunkProgress?.(chunks.length + 1, chunks.length + 1);

  const summary = finalSummary || chunkSummaries.join(" ");
  if (!summary) throw new Error("Summarization returned an empty result.");

  return {
    summary,
    inputWords,
    outputWords: countWords(summary),
    chunks: chunks.length,
  };
}

/** True if the model is already loaded (cached in memory). */
export function isModelLoaded(): boolean {
  return summarizer !== null;
}
