/**
 * Markdown to HTML conversion using `marked` (Node-safe, no browser globals).
 *
 * Safety guarantees:
 * 1. Raw HTML blocks and inline HTML in the input are escaped (not passed
 *    through) so that `<script>` tags and other injected markup cannot
 *    survive as executable HTML in the output.
 * 2. Links and images whose href/src uses a dangerous URI scheme
 *    (javascript:, data:, vbscript:) are neutralised: the href/src is
 *    replaced with "#". This defeats both plain and entity-obfuscated
 *    variants (e.g. `java&#115;cript:`) by decoding HTML entities before
 *    the scheme check. Safe schemes (http, https, mailto, relative paths,
 *    anchor fragments) pass through unmodified.
 * 3. All user-controlled values interpolated into HTML attributes or text
 *    content (href, src, title, alt, link label text) are passed through
 *    escapeHtml before interpolation, closing attribute-breakout and
 *    raw-HTML-in-label injection vectors. The link label (text) is treated
 *    as plain text: in this version of marked, emphasis/strong inside a
 *    link label is NOT recursively rendered -- the label arrives as the
 *    literal source characters -- so escaping it is both safe and necessary.
 */
import { marked, Renderer, type Tokens } from "marked";
import { z } from "zod";
import type { ToolDef } from "./types.js";
import { escapeHtml } from "./util.js";

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
  const safeHref = isSafeUri(href) ? escapeHtml(href) : "#";
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  // In this version of marked the link label (text) arrives as the raw source
  // characters -- inline markup such as **bold** is NOT pre-rendered into child
  // HTML. Escaping it is therefore both correct and required to close the
  // raw-HTML-in-label injection vector.
  return `<a href="${safeHref}"${titleAttr}>${escapeHtml(text)}</a>`;
};

safeRenderer.image = ({ href, title, text }: Tokens.Image) => {
  const safeSrc = isSafeUri(href) ? escapeHtml(href) : "#";
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${safeSrc}" alt="${escapeHtml(text)}"${titleAttr}>`;
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
      description: "Convert Markdown to HTML using marked (GFM enabled). All raw HTML in the input is escaped (no <script> pass-through, no inline event handlers). Links and images with javascript:, data:, or vbscript: URIs are neutralised (href/src set to '#'), including entity-obfuscated and whitespace-padded variants. Link label text, titles, and alt attributes are HTML-escaped before interpolation, closing attribute-breakout and raw-HTML-in-label injection vectors.",
      inputSchema: z.object({ markdown: z.string() }),
      run({ markdown }) {
        return { html: toHtml(markdown) };
      },
    },
  ],
};
