import DOMPurify from "dompurify";
import { Marked, marked } from "marked";

// Configure the global marked instance for GFM + line breaks (used by parseInline helpers)
marked.setOptions({
  gfm: true,
  breaks: false,
});

/**
 * Converts markdown string to sanitized HTML.
 * Uses marked for GFM parsing and DOMPurify for sanitization.
 *
 * Headings h1-h3 are emitted with `id` attributes matching the deduped slugs
 * produced by extractToc, so TOC anchor links resolve correctly even when the
 * same heading text appears more than once.
 */
export function renderMarkdown(md: string): string {
  // Per-render slug dedup counter so repeated headings get `setup`, `setup-1`, ...
  const seenSlugs = new Map<string, number>();

  // Use a local Marked instance so the heading renderer (with per-call state) does
  // not mutate the global marked instance used elsewhere.
  const localMarked = new Marked({ gfm: true, breaks: false });
  localMarked.use({
    renderer: {
      heading({ tokens, depth }: { tokens: marked.Token[]; depth: number }): string {
        // Reconstruct the raw heading text to derive the slug
        const rawText = tokens
          .map((t) => ("raw" in t && typeof t.raw === "string" ? t.raw : ""))
          .join("");
        const plainText = rawText.replace(/\*+|`/g, "");
        const base = slugify(plainText);
        const count = seenSlugs.get(base) ?? 0;
        seenSlugs.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        // Render the inline content through marked's inline parser
        const inner = marked.parseInline(rawText) as string;
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
    },
  });

  const raw = localMarked.parse(md) as string;
  // DOMPurify may not be available in test environment (no DOM)
  if (typeof window === "undefined") return raw;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "hr",
      "strong",
      "em",
      "del",
      "ins",
      "mark",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "a",
      "img",
      "div",
      "span",
      // GFM task lists: marked emits <input type="checkbox"> inside <li>
      "input",
    ],
    ALLOWED_ATTR: [
      "href",
      "src",
      "alt",
      "title",
      "class",
      "id",
      "target",
      "rel",
      // GFM task-list checkboxes
      "type",
      "checked",
      "disabled",
    ],
    ALLOW_DATA_ATTR: false,
  });
}

export interface WordStats {
  words: number;
  chars: number;
  lines: number;
}

/**
 * Count words, characters, and lines in raw markdown text.
 * Words = whitespace-separated tokens on non-empty content.
 */
export function countStats(md: string): WordStats {
  const trimmed = md.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  const chars = md.length;
  const lines = md === "" ? 0 : md.split("\n").length;
  return { words, chars, lines };
}

/**
 * Wrap rendered HTML in a full HTML document for export.
 */
export function wrapHtmlDocument(bodyHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlAttr(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a2530; }
    pre { background: #f4f5f6; border-radius: 6px; padding: 1rem; overflow-x: auto; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.88em; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #2f9d8d; margin: 0; padding-left: 1rem; color: #5b6671; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e8eaed; padding: 0.5rem 0.75rem; }
    th { background: #f4f5f6; }
    img { max-width: 100%; }
    a { color: #2f9d8d; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── TOC extraction ─────────────────────────────────────────────────────────

export interface TocEntry {
  level: 1 | 2 | 3;
  text: string;
  /** URL-safe slug for anchor linking */
  slug: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Build a deduplicated slug using the same counter logic used by renderMarkdown's
 * heading renderer. Returns `slug`, `slug-1`, `slug-2`, ... for repeated headings.
 */
function deduplicatedSlug(text: string, seen: Map<string, number>): string {
  const base = slugify(text);
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

/**
 * Extract headings (h1-h3) from raw markdown source for a table of contents.
 * Duplicate heading texts get disambiguated slugs (`setup`, `setup-1`, ...) so
 * they match the ids emitted by renderMarkdown.
 */
export function extractToc(md: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const seen = new Map<string, number>();
  const lines = md.split("\n");
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3;
    const text = m[2].trim();
    const slug = deduplicatedSlug(text, seen);
    entries.push({ level, text, slug });
  }
  return entries;
}

/**
 * Open a print dialog for the rendered HTML, styled for clean PDF export.
 * Uses a hidden iframe so the main page layout is not disturbed.
 */
export function printAsPdf(bodyHtml: string, title: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;opacity:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtmlAttr(title)}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; } }
    body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.7; color: #111; font-size: 11pt; }
    h1,h2,h3,h4,h5,h6 { font-family: system-ui, sans-serif; font-weight: 700; margin-top: 1.4em; margin-bottom: 0.4em; }
    h1 { font-size: 1.8rem; } h2 { font-size: 1.35rem; } h3 { font-size: 1.1rem; }
    pre { background: #f4f5f6; border: 1px solid #ddd; border-radius: 4px; padding: 0.85rem; overflow-x: auto; font-size: 9pt; }
    code { font-family: 'Courier New', monospace; font-size: 0.88em; background: #f4f5f6; padding: 0.1em 0.3em; border-radius: 3px; }
    pre code { background: none; padding: 0; }
    blockquote { border-left: 3px solid #2f9d8d; margin: 0; padding: 0.4em 1em; color: #555; }
    table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 0.4rem 0.6rem; text-align: left; }
    th { background: #f0f0f0; font-weight: 600; }
    img { max-width: 100%; }
    a { color: #2f9d8d; }
    input[type="checkbox"] { margin-right: 0.35em; }
    li { margin-bottom: 0.2em; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 200);
}

/**
 * Apply a markdown toolbar action to the current textarea content.
 * Returns the new value plus the new cursor selection [start, end].
 */
export type ToolbarAction = "bold" | "h1" | "h2" | "h3" | "link" | "code" | "codeblock";

export interface ToolbarResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function applyToolbarAction(
  value: string,
  selStart: number,
  selEnd: number,
  action: ToolbarAction
): ToolbarResult {
  const before = value.slice(0, selStart);
  const selected = value.slice(selStart, selEnd);
  const after = value.slice(selEnd);

  switch (action) {
    case "bold": {
      const wrapped = `**${selected || "bold text"}**`;
      const newVal = before + wrapped + after;
      const innerStart = selStart + 2;
      const innerEnd = innerStart + (selected || "bold text").length;
      return { value: newVal, selectionStart: innerStart, selectionEnd: innerEnd };
    }
    case "h1":
    case "h2":
    case "h3": {
      const level = action === "h1" ? 1 : action === "h2" ? 2 : 3;
      const hashes = "#".repeat(level);
      // Apply to the line containing the cursor
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineEnd = after.indexOf("\n");
      const lineAfterEnd = lineEnd === -1 ? value.length : selEnd + lineEnd;
      const lineContent = value.slice(lineStart, lineAfterEnd);
      // Strip existing heading hashes
      const stripped = lineContent.replace(/^#+\s*/, "");
      const newLine = `${hashes} ${stripped}`;
      const newVal = value.slice(0, lineStart) + newLine + value.slice(lineAfterEnd);
      const cursorPos = lineStart + newLine.length;
      return { value: newVal, selectionStart: cursorPos, selectionEnd: cursorPos };
    }
    case "link": {
      const text = selected || "link text";
      const wrapped = `[${text}](https://example.com)`;
      const newVal = before + wrapped + after;
      // Select the URL part for easy replacement
      const urlStart = selStart + text.length + 3;
      const urlEnd = urlStart + "https://example.com".length;
      return { value: newVal, selectionStart: urlStart, selectionEnd: urlEnd };
    }
    case "code": {
      const wrapped = `\`${selected || "code"}\``;
      const newVal = before + wrapped + after;
      const innerStart = selStart + 1;
      const innerEnd = innerStart + (selected || "code").length;
      return { value: newVal, selectionStart: innerStart, selectionEnd: innerEnd };
    }
    case "codeblock": {
      const content = selected || "code here";
      const wrapped = `\`\`\`\n${content}\n\`\`\``;
      const newVal = before + wrapped + after;
      const innerStart = selStart + 4;
      const innerEnd = innerStart + content.length;
      return { value: newVal, selectionStart: innerStart, selectionEnd: innerEnd };
    }
  }
}
