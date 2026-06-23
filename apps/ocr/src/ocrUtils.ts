/**
 * Pure utility functions for OCR text post-processing.
 * These are tested independently of the Tesseract worker.
 */

/** localStorage key for the last-used OCR language. */
export const LANG_STORAGE_KEY = "ocr-last-language";

/**
 * Read the persisted language from localStorage, falling back to "eng".
 * Returns "eng" if localStorage is unavailable (e.g. SSR / private mode).
 */
export function loadPersistedLanguage(): string {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) ?? "eng";
  } catch {
    return "eng";
  }
}

/** Persist the selected language to localStorage. */
export function persistLanguage(lang: string): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // ignore quota / private-mode errors
  }
}

/**
 * Build a sample PNG File containing short English text, rendered via an
 * offscreen canvas. Returns null in environments without canvas support
 * (e.g. test runners without a DOM).
 */
export function createSampleImageFile(): File | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dark text -- simple enough for Tesseract to read confidently
    ctx.fillStyle = "#1a2530";
    ctx.font = "bold 32px serif";
    ctx.fillText("Hello, OCR!", 40, 72);
    ctx.font = "24px serif";
    ctx.fillText("Drop an image or try a sample.", 40, 120);
    ctx.font = "20px serif";
    ctx.fillStyle = "#5b6671";
    ctx.fillText("Runs entirely in your browser.", 40, 162);

    // Convert to File
    const dataUrl = canvas.toDataURL("image/png");
    const byteString = atob(dataUrl.split(",")[1]);
    const arr = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      arr[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arr], { type: "image/png" });
    return new File([blob], "sample.png", { type: "image/png" });
  } catch {
    return null;
  }
}

/** Normalise line endings and strip trailing whitespace per line. */
export function normaliseText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

/** Build a download-safe filename from the source image name. */
export function buildFilename(sourceName: string, ext = "txt"): string {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");
  return `${base || "ocr-result"}.${ext}`;
}

/** Return a human-readable confidence label for a 0-100 score. */
export function confidenceLabel(score: number): string {
  if (score >= 85) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

/** Trigger a .txt download from a string. */
export function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Render a single PDF page to an image File using pdfjs-dist.
 * Scale defaults to 2.0 for decent OCR resolution.
 * Returns null if pdfjs-dist is unavailable or rendering fails.
 */
export async function renderPdfPageToFile(
  pdfFile: File,
  pageIndex: number,
  scale = 2.0
): Promise<File | null> {
  try {
    // Dynamic import so pdfjs-dist only loads when a PDF is actually dropped.
    const pdfjsLib = await import("pdfjs-dist");
    // Point the worker at the bundled worker file via CDN to avoid complex
    // bundler configuration. This is the standard pdfjs-dist browser pattern.
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await pdfFile.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    if (pageIndex >= pdf.numPages) return null;

    const page = await pdf.getPage(pageIndex + 1); // pdfjs is 1-indexed
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    return await canvasToFile(canvas, `page-${pageIndex + 1}.png`);
  } catch {
    return null;
  }
}

/**
 * Count pages in a PDF file. Returns 0 on error.
 */
export async function getPdfPageCount(pdfFile: File): Promise<number> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return 0;
  }
}

/**
 * Crop a canvas region to a new File.
 * rect is in natural image coordinates (matching the displayed img).
 */
export function cropImageToFile(
  imageUrl: string,
  rect: { x: number; y: number; w: number; h: number },
  filename: string
): Promise<File | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(rect.w);
      canvas.height = Math.round(rect.h);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, canvas.width, canvas.height);
      canvasToFile(canvas, filename).then(resolve);
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}

/** Convert an HTMLCanvasElement to a PNG File. */
async function canvasToFile(canvas: HTMLCanvasElement, filename: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      resolve(new File([blob], filename, { type: "image/png" }));
    }, "image/png");
  });
}

/** Word confidence data from Tesseract word-level output. */
export interface WordConfidence {
  text: string;
  confidence: number; // 0-100
}

/**
 * Parse Tesseract HOCR words with confidence below a threshold into a
 * flat array for display. Input is the raw text from result.data.words.
 * Returns an empty array if words is falsy.
 */
export function extractLowConfidenceWords(
  words: Array<{ text: string; confidence: number }> | undefined,
  threshold = 60
): WordConfidence[] {
  if (!words) return [];
  return words
    .filter((w) => w.text.trim().length > 0 && w.confidence < threshold)
    .map((w) => ({ text: w.text, confidence: Math.round(w.confidence) }));
}

/**
 * Build batch filename for multi-image downloads.
 * e.g. buildBatchFilename("photo.png", 0) => "photo_page1.txt"
 */
export function buildBatchFilename(sourceName: string, index: number): string {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");
  return `${base || "ocr-result"}_page${index + 1}.txt`;
}

/**
 * Concatenate multiple OCR results into a single downloadable text with
 * section headers so the user can keep all pages together.
 */
export function buildCombinedText(items: Array<{ name: string; text: string }>): string {
  return items
    .map((item, i) => {
      const header = `=== ${item.name || `Page ${i + 1}`} ===`;
      return `${header}\n\n${item.text}`;
    })
    .join("\n\n\n");
}
