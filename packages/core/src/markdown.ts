/**
 * Markdown to HTML conversion using `marked` (Node-safe, no browser globals).
 *
 * Raw HTML blocks in the input are escaped (not passed through) so that
 * `<script>` tags and other injected markup cannot survive as executable
 * HTML in the output. This is safe for MCP tool use where the caller
 * controls the input and the output is typically rendered client-side.
 */
import { marked, Renderer } from "marked";
import { z } from "zod";
import type { ToolDef } from "./types.js";

// Override the renderer so that raw HTML blocks and inline HTML are escaped
// rather than passed through verbatim. This prevents <script> injection.
const safeRenderer = new Renderer();

safeRenderer.html = ({ text }: { text: string }) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

marked.setOptions({ gfm: true, breaks: false });

export function toHtml(md: string): string {
  return marked.parse(md, { renderer: safeRenderer }) as string;
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const markdownTool: ToolDef = {
  slug: "markdown",
  name: "Markdown",
  ops: [
    {
      name: "toHtml",
      description: "Convert Markdown to HTML using marked (GFM enabled). Raw HTML in the input is escaped, so embedded <script> tags are neutralised.",
      inputSchema: z.object({ markdown: z.string() }),
      run({ markdown }) {
        return { html: toHtml(markdown) };
      },
    },
  ],
};
