/**
 * Neural machine translation using @huggingface/transformers.
 *
 * Model: see MODEL_ID const below (~600 MB on first download, cached in browser thereafter).
 *
 * COOP/COEP note: GitHub Pages cannot send cross-origin isolation headers, so
 * SharedArrayBuffer is unavailable. We force numThreads=1 before any ONNX
 * session is created, this uses the single-threaded WASM backend and avoids
 * any SharedArrayBuffer requirement. WebGPU is preferred when available
 * (no isolation required); single-thread WASM is the fallback.
 */
import { pipeline } from "@huggingface/transformers";
import { configureTransformersEnv } from "@junkyardsh/ui/ai";
import { DETECT_CODE, splitIntoChunks } from "./languages";

const MODEL_ID = "Xenova/nllb-200-distilled-600M";

export type ProgressCallback = (loaded: number, total: number, status: string) => void;

/** Called for each chunk during chunked translation: chunkIndex, totalChunks */
export type ChunkProgressCallback = (done: number, total: number) => void;

type TransformersProgressEvent = {
  status: string;
  loaded?: number;
  total?: number;
  file?: string;
};

// Internal pipeline type, the transformers.js type union is wide; we cast at
// call time to avoid "any" propagating through callers.
type TranslationPipeline = (
  text: string,
  opts: { src_lang: string; tgt_lang: string; max_new_tokens?: number }
) => Promise<{ translation_text: string }[]>;

let translator: TranslationPipeline | null = null;

/** Load (or return cached) the translation pipeline. */
export async function loadTranslator(onProgress?: ProgressCallback): Promise<void> {
  if (translator) return;
  await configureTransformersEnv();

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

  // Cast via unknown, "translation" always returns a text2text pipeline.
  translator = (await (
    pipeline as (task: string, model: string, opts: Record<string, unknown>) => Promise<unknown>
  )("translation", MODEL_ID, {
    progress_callback: progressCb,
  })) as TranslationPipeline;
}

export interface TranslationResult {
  translatedText: string;
  /** Resolved source language code (useful when input was DETECT_CODE) */
  resolvedSourceLang: string;
}

/**
 * Best-effort language detection from a text sample.
 *
 * The NLLB model does not expose a language-ID head, so we use a lightweight
 * Unicode-script heuristic for a handful of distinctive scripts, then fall back
 * to English.  This covers the most common auto-detect cases without a second
 * model download.
 *
 * Exported for unit testing.
 */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 300);

  // Script-based heuristics (check more-distinctive scripts first)
  // Hiragana/Katakana before CJK so Japanese is not swallowed by the CJK block
  if (/[぀-ゟ゠-ヿ]/.test(sample)) return "jpn_Jpan";
  if (/[가-힣]/.test(sample)) return "kor_Hang"; // Hangul syllables
  if (/[一-鿿㐀-䶿]/.test(sample)) {
    // CJK unified ideographs -- Traditional vs Simplified is hard to distinguish
    // from script alone; default to Simplified which is more common.
    return "zho_Hans";
  }
  if (/[؀-ۿ]/.test(sample)) return "arb_Arab"; // Arabic block
  if (/[Ѐ-ӿ]/.test(sample)) return "rus_Cyrl"; // Cyrillic (default Russian)
  if (/[ऀ-ॿ]/.test(sample)) return "hin_Deva"; // Devanagari
  if (/[฀-๿]/.test(sample)) return "tha_Thai"; // Thai
  if (/[Ͱ-Ͽ]/.test(sample)) return "ell_Grek"; // Greek
  if (/[֐-׿]/.test(sample)) return "heb_Hebr"; // Hebrew

  // Latin-script language heuristics based on distinctive diacritics
  // (checked before defaulting to English)
  if (/[äöüßÄÖÜ]/.test(sample)) return "deu_Latn"; // German-specific
  if (/[àâçèéêëîïôùûü]/.test(sample)) return "fra_Latn"; // French-specific
  if (/[áéíóúüñ¿¡]/.test(sample)) return "spa_Latn"; // Spanish
  if (/[ãõàáâéê]/.test(sample)) return "por_Latn"; // Portuguese
  if (/[àèìòùé]/.test(sample)) return "ita_Latn"; // Italian

  // Default: assume English
  return "eng_Latn";
}

/** Translate text from sourceLang to targetLang using NLLB codes.
 *
 *  If sourceLang is DETECT_CODE the source language is auto-detected from the
 *  input text.  Long inputs are transparently split into sentence chunks; the
 *  optional onChunkProgress callback fires after each chunk completes.
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  onChunkProgress?: ChunkProgressCallback
): Promise<TranslationResult> {
  if (!translator) throw new Error("Model not loaded, call loadTranslator() first.");
  if (!text.trim()) return { translatedText: "", resolvedSourceLang: sourceLang };

  const resolvedSourceLang = sourceLang === DETECT_CODE ? detectLanguage(text) : sourceLang;

  const chunks = splitIntoChunks(text);
  const translated: string[] = [];

  // Signal inference-started before the first chunk so single-chunk inputs
  // flip to "translating" phase immediately (chunk_progress only fires after
  // each chunk completes, so without this single-chunk stays on "Downloading").
  onChunkProgress?.(0, chunks.length);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const result = await translator(chunk, {
      src_lang: resolvedSourceLang,
      tgt_lang: targetLang,
      max_new_tokens: 512,
    });
    translated.push(result[0]?.translation_text ?? "");
    onChunkProgress?.(i + 1, chunks.length);
  }

  return { translatedText: translated.join(" "), resolvedSourceLang };
}

/** True if the model is already loaded (cached in memory). */
export function isTranslatorLoaded(): boolean {
  return translator !== null;
}
