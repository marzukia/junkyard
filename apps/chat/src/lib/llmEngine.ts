/**
 * WebLLM engine wrapper.
 *
 * COOP/COEP note: WebLLM uses WebGPU for inference, which does NOT require
 * SharedArrayBuffer or cross-origin isolation headers. GitHub Pages can serve
 * this app without any special headers.
 *
 * Model: Llama-3.2-1B-Instruct-q4f16_1-MLC (~700 MB quantised)
 * WebGPU required: detect navigator.gpu before calling loadEngine().
 *
 * This module is dynamically imported so the initial bundle stays small.
 */

import type { MLCEngine } from "@mlc-ai/web-llm";

export const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
export const MODEL_SIZE_LABEL = "~700 MB";

export type ProgressCallback = (text: string, loaded: number, total: number) => void;

let engine: MLCEngine | null = null;
// Abort controller for the current generation stream. Replaced each call.
let currentAbortController: AbortController | null = null;

/** Load the MLCEngine. Idempotent if already loaded. */
export async function loadEngine(onProgress?: ProgressCallback): Promise<void> {
  if (engine) return;

  // Dynamic import keeps WebLLM out of the initial bundle
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

  engine = await CreateMLCEngine(MODEL_ID, {
    initProgressCallback: (report) => {
      if (!onProgress) return;
      // WebLLM progress report: { text, progress, timeElapsed }
      const progressVal = typeof report.progress === "number" ? report.progress : 0;
      // progress is 0-1 float; convert to loaded/total as byte-like integers
      const total = 1_000_000;
      const loaded = Math.round(progressVal * total);
      onProgress(report.text ?? "", loaded, total);
    },
  });
}

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Run a streaming chat completion.
 * Calls onChunk for each token, resolves when generation finishes.
 * Respects the abort signal returned by getCurrentAbortController().
 */
export async function streamChat(
  messages: ChatTurn[],
  onChunk: (delta: string) => void
): Promise<void> {
  if (!engine) throw new Error("Engine not loaded, call loadEngine() first.");

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.7,
    max_tokens: 1024,
  });

  for await (const chunk of stream) {
    if (signal.aborted) break;
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (delta) onChunk(delta);
  }

  currentAbortController = null;
}

/** Abort the current in-progress generation, if any. */
export function abortGeneration(): void {
  currentAbortController?.abort();
  currentAbortController = null;
}

/** True if the engine has been loaded. */
export function isEngineLoaded(): boolean {
  return engine !== null;
}
