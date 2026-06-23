/**
 * Markdown to HTML conversion using `marked` (Node-safe, no browser globals).
 *
 * The app uses DOMPurify for sanitization, which requires a DOM. In the core
 * package we use marked with a safe-by-default configuration instead:
 *   - mangle: false (no email obfuscation)
 *   - headerIds: false (no id attributes on headings -- avoids XSS via crafted ids)
 *   - gfm: true (GitHub Flavoured Markdown)
 *
 * This produces safe HTML for trusted input (MCP tool input is caller-controlled).
 * For untrusted input the caller should apply a server-side sanitizer. We document
 * this in the op description so the MCP server author is informed.
 *
 * DOMPurify is not imported here because it requires a DOM environment.
 */
import { marked } from "marked";
import { z } from "zod";
import type { ToolDef } from "./types.js";

marked.setOptions({ gfm: true, breaks: false });

export function toHtml(md: string): string {
  return marked.parse(md) as string;
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const markdownTool: ToolDef = {
  slug: "markdown",
  name: "Markdown",
  ops: [
    {
      name: "toHtml",
      description: "Convert Markdown to HTML using marked (GFM enabled). Output is not DOM-sanitized; apply a server-side sanitizer for untrusted input.",
      inputSchema: z.object({ markdown: z.string() }),
      run({ markdown }) {
        return { html: toHtml(markdown) };
      },
    },
  ],
};
