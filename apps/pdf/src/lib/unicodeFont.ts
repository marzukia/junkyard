/**
 * Unicode font embedding helper for pdf-lib.
 *
 * pdf-lib's StandardFonts (Helvetica, Times, Courier) are WinAnsi-encoded
 * (Latin-1 only). Any character outside that range -- e.g. ₹ (U+20B9 RUPEE
 * SIGN), CJK, Arabic, emoji -- causes a hard crash: "WinAnsi cannot encode".
 *
 * This module wraps the proven pattern from apps/ocr: register @pdf-lib/fontkit
 * on the PDFDocument, lazy-fetch a Noto woff2 from jsDelivr CDN, and embed it
 * with subset:true so only the glyphs actually used end up in the output file.
 *
 * If the CDN fetch fails the caller receives null and MUST fall back gracefully
 * (sanitize unencodable chars, use a StandardFont, log a warning) so the PDF
 * is still produced rather than crashing.
 *
 * Deferred split: this file is vendored per-app because the apps are standalone
 * Vite projects with separate node_modules. When a shared package layer exists,
 * extract to packages/pdf-utils/unicodeFont.ts.
 */

import type { PDFDocument, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Noto Sans covers Latin-ext + virtually all non-CJK/Arabic scripts including
// ₹ (Rupee), ₿ (Bitcoin), Devanagari, Greek, Cyrillic, Vietnamese, etc.
// The latin-ext subset from @fontsource is ~400 KB and covers the vast majority
// of use-cases in invoice/resume/sign without needing the multi-MB CJK fonts.
const NOTO_SANS_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-latin-ext-400-normal.woff2";

const NOTO_SANS_BOLD_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5/files/noto-sans-latin-ext-700-normal.woff2";

const FETCH_TIMEOUT_MS = 30_000;

async function fetchBytes(url: string): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      console.warn(`[unicode-font] Fetch failed (${resp.status}): ${url}`);
      return null;
    }
    return new Uint8Array(await resp.arrayBuffer());
  } catch (err) {
    console.warn("[unicode-font] Fetch error:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface UnicodeFontSet {
  regular: PDFFont;
  bold: PDFFont;
  /** True when a Unicode font was embedded; false means StandardFont fallback is in use */
  isUnicode: boolean;
}

/**
 * Register fontkit on `doc` and embed Noto Sans (regular + bold) from CDN.
 * Returns null if the CDN is unreachable -- caller must handle that case.
 *
 * Call once per PDFDocument; the returned fonts can be reused across all pages.
 */
export async function embedUnicodeFonts(doc: PDFDocument): Promise<UnicodeFontSet | null> {
  doc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fetchBytes(NOTO_SANS_URL),
    fetchBytes(NOTO_SANS_BOLD_URL),
  ]);

  if (!regularBytes || !boldBytes) return null;

  try {
    const [regular, bold] = await Promise.all([
      doc.embedFont(regularBytes, { subset: true }),
      doc.embedFont(boldBytes, { subset: true }),
    ]);
    return { regular, bold, isUnicode: true };
  } catch (err) {
    console.warn("[unicode-font] Embed failed:", err);
    return null;
  }
}

/**
 * Strip characters that cannot be encoded in WinAnsi (Latin-1 range 0x20..0xFF).
 * Used as a last-resort fallback when the Unicode font is unavailable, so the
 * document is produced (with mangled text) rather than throwing.
 */
export function sanitizeWinAnsi(text: string): string {
  return text.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
}
