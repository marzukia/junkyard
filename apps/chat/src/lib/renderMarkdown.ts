/**
 * Lightweight markdown-to-JSX-safe-HTML renderer.
 *
 * Handles the subset an AI chat response commonly produces:
 *   - Fenced code blocks (``` ... ```) with optional language label
 *   - Inline code (`...`)
 *   - Bold (**text**)
 *   - Italic (*text*)
 *   - Unordered lists (- item or * item)
 *   - Ordered lists (1. item)
 *   - ATX headers (# H1 through ### H3)
 *   - Paragraph breaks (double newline)
 *
 * Returns an HTML string. The caller is responsible for using
 * dangerouslySetInnerHTML; inputs are escaped before processing.
 *
 * Kept simple and dependency-free. If the model starts producing tables or
 * complex nesting, replace with a real library (e.g. marked or micromark).
 */

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(text: string): string {
  // Inline code first (highest priority, prevents nested processing inside backticks)
  return escHtml(text)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

/** Render a list block. listLines should be the raw lines without the leading marker. */
function renderList(items: string[], ordered: boolean): string {
  const tag = ordered ? "ol" : "ul";
  const inner = items.map((item) => `<li>${renderInline(item.trim())}</li>`).join("");
  return `<${tag}>${inner}</${tag}>`;
}

export function renderMarkdown(raw: string): string {
  const blocks: string[] = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ───────────────────────────────────────────────────
    const fenceMatch = line.match(/^```(\w*)$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] ?? "";
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      const code = escHtml(codeLines.join("\n"));
      const langAttr = lang ? ` data-lang="${escHtml(lang)}"` : "";
      blocks.push(`<pre${langAttr}><code>${code}</code></pre>`);
      continue;
    }

    // ── ATX headers ────────────────────────────────────────────────────────
    const h3Match = line.match(/^### (.+)/);
    if (h3Match) {
      blocks.push(`<h3>${renderInline(h3Match[1])}</h3>`);
      i++;
      continue;
    }
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      blocks.push(`<h2>${renderInline(h2Match[1])}</h2>`);
      i++;
      continue;
    }
    const h1Match = line.match(/^# (.+)/);
    if (h1Match) {
      blocks.push(`<h1>${renderInline(h1Match[1])}</h1>`);
      i++;
      continue;
    }

    // ── Unordered list ──────────────────────────────────────────────────────
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(renderList(items, false));
      continue;
    }

    // ── Ordered list ────────────────────────────────────────────────────────
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push(renderList(items, true));
      continue;
    }

    // ── Blank line ──────────────────────────────────────────────────────────
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Paragraph (collect consecutive non-empty, non-special lines) ────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${renderInline(paraLines.join("\n"))}</p>`);
    }
  }

  return blocks.join("\n");
}
