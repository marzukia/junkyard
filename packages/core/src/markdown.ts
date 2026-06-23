/**
 * Markdown to HTML conversion using `marked` (Node-safe, no browser globals).
 *
 * Safety guarantees:
 * 1. Raw HTML blocks in the input are escaped (not passed through) so that
 *    `<script>` tags and other injected markup cannot survive as executable
 *    HTML in the output.
 * 2. Links and images whose href/src uses a dangerous URI scheme
 *    (javascript:, data:, vbscript:) are neutralised: the href/src is
 *    replaced with "#". This defeats both plain and entity-obfuscated
 *    variants (e.g. `java&#115;cript:`) by decoding HTML entities before
 *    the scheme check. Safe schemes (http, https, mailto, relative paths,
 *    anchor fragments) pass through unmodified.
 */
import { marked, Renderer, type Tokens } from "marked";
import { z } from "zod";
import type { ToolDef } from "./types.js";

// Schemes that must never appear in href or src attributes.
const BLOCKED_SCHEMES = ["javascript:", "data:", "vbscript:"];

/**
 * Decode HTML entities that browsers resolve before interpreting a URI
 * (e.g. `&#115;` -> `s`, `&colon;` -> `:`), then extract the scheme.
 * Returns the scheme in lower-case with the colon, e.g. "javascript:".
 */
function extractScheme(uri: string): string {
  // Minimal entity decode covering numeric (&#NNN; &#xHH;) and &colon;
  const decoded = uri
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&colon;/gi, ":");
  // Strip ASCII whitespace/control chars that browsers ignore inside schemes
  const stripped = decoded.replace(/[\x00-\x20]/g, "");
  const m = stripped.match(/^([a-z][a-z0-9+\-.]*:)/i);
  return m ? m[1].toLowerCase() : "";
}

function isSafeUri(uri: string): boolean {
  const scheme = extractScheme(uri.trim());
  if (!scheme) return true; // relative path, anchor, or empty -- safe
  return !BLOCKED_SCHEMES.some((b) => scheme === b);
}

// Override the renderer so that raw HTML blocks and inline HTML are escaped
// rather than passed through verbatim, and so that dangerous URI schemes in
// links and images are neutralised.
const safeRenderer = new Renderer();

safeRenderer.html = ({ text }: { text: string }) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

safeRenderer.link = ({ href, title, text }: Tokens.Link) => {
  const safeHref = isSafeUri(href) ? href : "#";
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${safeHref}"${titleAttr}>${text}</a>`;
};

safeRenderer.image = ({ href, title, text }: Tokens.Image) => {
  const safeSrc = isSafeUri(href) ? href : "#";
  const titleAttr = title ? ` title="${title}"` : "";
  return `<img src="${safeSrc}" alt="${text}"${titleAttr}>`;
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
      description: "Convert Markdown to HTML using marked (GFM enabled). Raw HTML is escaped (no <script> pass-through). Links and images with javascript:, data:, or vbscript: URIs are neutralised (href/src set to '#'), including entity-obfuscated variants.",
      inputSchema: z.object({ markdown: z.string() }),
      run({ markdown }) {
        return { html: toHtml(markdown) };
      },
    },
  ],
};
