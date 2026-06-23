/**
 * Pure text-processing helpers, no DOM side-effects, easily unit-tested.
 */

// DistilBART CNN 6-6 max encoder tokens; conservative word estimate (0.75 tokens/word).
export const MODEL_MAX_WORDS = Math.floor(1024 * 0.75); // 768

/**
 * A short sample article (public domain) used for the "Try sample" button.
 * Keeps the empty-state from being a blank wall.
 */
export const SAMPLE_TEXT =
  "The Great Barrier Reef, located off the coast of Queensland in northeastern Australia, " +
  "is the world's largest coral reef system, stretching over 2,300 kilometres. " +
  "Composed of over 2,900 individual reefs and 900 islands, it is so large that it can be seen from outer space. " +
  "The reef supports an extraordinary variety of life, including more than 1,500 species of fish, " +
  "4,000 types of mollusc, and 240 species of birds. " +
  "It was designated a UNESCO World Heritage Site in 1981 and is considered one of the seven natural wonders of the world. " +
  "However, the reef faces serious threats from climate change, particularly ocean warming and acidification, " +
  "which cause coral bleaching. Mass bleaching events in 2016, 2017, 2020, 2022, and 2024 killed or damaged " +
  "large sections of the reef. Pollution and runoff from agricultural land also contribute to its decline. " +
  "Scientists and conservationists are working on interventions such as coral restoration, selective breeding " +
  "for heat tolerance, and reduced carbon emissions, but many warn that without urgent global action to " +
  "limit warming to 1.5 degrees Celsius, much of the reef could be lost within decades.";

/** Count words in a string (whitespace-delimited). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Format a word count for display, e.g. "1,234 words". */
export function formatWordCount(count: number): string {
  if (count === 1) return "1 word";
  return `${count.toLocaleString()} words`;
}

/**
 * Compute the percentage reduction from input words to output words.
 * Returns a string like "72% shorter".
 */
export function formatReduction(inputWords: number, outputWords: number): string {
  if (inputWords <= 0 || outputWords >= inputWords) return "";
  const pct = Math.round(((inputWords - outputWords) / inputWords) * 100);
  return `${pct}% shorter`;
}

/** Format a download progress fraction as a percentage string. */
export function formatProgress(loaded: number, total: number): string {
  if (total <= 0) return "0%";
  const pct = Math.min(100, Math.round((loaded / total) * 100));
  return `${pct}%`;
}

/**
 * Clamp a number between min and max (inclusive).
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Given a slider position (0–100), map to a max-word target.
 * Positions map to: short (50), medium (100), long (200), very long (300).
 */
export function sliderToMaxWords(position: number): number {
  if (position <= 25) return Math.round(30 + (position / 25) * (50 - 30));
  if (position <= 50) return Math.round(50 + ((position - 25) / 25) * (100 - 50));
  if (position <= 75) return Math.round(100 + ((position - 50) / 25) * (200 - 100));
  return Math.round(200 + ((position - 75) / 25) * (300 - 200));
}

/**
 * Given a max-word target, derive a sensible min-word target
 * (roughly 40% of max, never below 10).
 */
export function maxWordsToMin(maxWords: number): number {
  return Math.max(10, Math.round(maxWords * 0.4));
}

/** Human-readable label for a given max-word count. */
export function lengthLabel(maxWords: number): string {
  if (maxWords <= 50) return "Brief";
  if (maxWords <= 100) return "Medium";
  if (maxWords <= 200) return "Detailed";
  return "Full";
}

/**
 * Split text into chunks that each fit within MODEL_MAX_WORDS.
 * Splits on sentence boundaries where possible (". ", "! ", "? ").
 * Returns an array of non-empty chunk strings.
 */
export function chunkText(text: string, maxWordsPerChunk: number = MODEL_MAX_WORDS): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWordsPerChunk) return [text.trim()];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + maxWordsPerChunk, words.length);
    // Try to find a sentence boundary to break on (within last 15% of the chunk).
    const slice = words.slice(start, end);
    let breakAt = slice.length;

    if (end < words.length) {
      // Walk backwards to find a word ending a sentence.
      const lookback = Math.max(1, Math.floor(slice.length * 0.85));
      for (let i = slice.length - 1; i >= lookback; i--) {
        const w = slice[i];
        if (/[.!?]$/.test(w)) {
          breakAt = i + 1;
          break;
        }
      }
    }

    const chunk = words.slice(start, start + breakAt).join(" ");
    if (chunk) chunks.push(chunk);
    start += breakAt;
  }

  return chunks;
}

/**
 * Returns whether text is long enough that it needs chunked processing.
 */
export function needsChunking(text: string): boolean {
  return countWords(text) > MODEL_MAX_WORDS;
}

/**
 * Attempt to extract plain text from an HTML string.
 * Removes script/style tags and collapses whitespace.
 */
export function extractTextFromHtml(html: string): string {
  // Remove script and style blocks
  const cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned;
}
