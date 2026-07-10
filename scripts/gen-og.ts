#!/usr/bin/env node
// Generates OG images (1200×630 PNG) for every app from catalogue data.
// Uses SVG → PNG via @resvg/resvg-wasm (pure WASM, no native deps).
// Fonts: Roboto (body) + Roboto Slab (title) via @fontsource woff2.
// Layout matches reference image exactly — pixel-perfect positioning.
// Run from repo root: bun scripts/gen-og.ts

import { writeFileSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { CATEGORY_COLORS } from "../packages/core/src/brand.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPS_DIR = join(ROOT, "apps");

// ── Text helpers ──────────────────────────────────────────────────────
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current.length === 0 ? word : `${current} ${word}`;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// ── Junkyard salvage tag icon (from favicon.svg) ─────────────────────
// ── Junkyard salvage tag icon (from favicon.svg) ─────────────────────
// The scrap tag is a ~34×34 unit glyph (rotated -13°); it's rendered at an
// arbitrary top-left (x,y) and pixel size so the layout can vertically
// centre it against the title block. `size` is the on-canvas box in px.
function tagIcon(x: number, y: number, size: number): string {
  const scale = size / 34; // the glyph's design box is ~34 units square
  return `<g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) scale(${scale.toFixed(3)})">
  <g transform="rotate(-13 16 16)">
    <clipPath id="jyTag"><path d="M14.2 4.6 L25 7.2 a1.6 1.6 0 0 1 1.2 1.2 L28.8 25 a1.8 1.8 0 0 1-1.5 2 L13 29.2 a1.8 1.8 0 0 1-2-1.5 L8.4 12 a1.8 1.8 0 0 1 .5-1.6 L13 6 Z"/></clipPath>
    <g clip-path="url(#jyTag)">
      <rect x="0" y="0" width="32" height="12.5" fill="#2f9d8d"/>
      <rect x="0" y="12.5" width="32" height="9" fill="#e8b04b"/>
      <rect x="0" y="21.5" width="32" height="11" fill="#d9594c"/>
    </g>
    <circle cx="13.2" cy="8.7" r="1.7" fill="#fff"/>
    <path d="M16 14.5 l4 3.4 l-4 3.4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</g>`;
}

// ── SVG template ─────────────────────────────────────────────────────
// Layout is computed from the content, then the whole {title, tagline,
// badges} group is vertically centred in the canvas and the icon is
// centred against the title — so 1- and 2-line names/taglines all sit on a
// consistent optical baseline instead of drifting off fixed coordinates.
function buildOgSvg(name: string, tagline: string, category: string, slug: string): string {
  const accent = CATEGORY_COLORS[category] ?? "#2f9d8d";

  const PAD_L = 80; // left margin (matches footer x)
  const ICON = 78; // icon box px
  const GAP_ICON_TEXT = 34; // space between icon and text column
  const TEXT_X = PAD_L + ICON + GAP_ICON_TEXT; // text column left edge

  // ── Type scale ──
  // Wrap width tuned to the large title font; long names drop to 2 lines.
  const nameLines = wrapText(name, 15);
  const nameFont = nameLines.length > 1 ? 52 : 62;
  const nameLH = Math.round(nameFont * 1.14);
  const tagLines = wrapText(tagline, 50);
  const tagFont = 22;
  const tagLH = 30;
  const GAP_TITLE_TAG = 26;

  // ── Content group = icon + title + tagline, vertically centred ──
  // (Feature badges + domain are pinned to the bottom row, matching the
  // reference layout, so they don't move with content length.)
  const titleH = nameLines.length * nameLH;
  const tagH = tagLines.length * tagLH;
  const groupH = titleH + GAP_TITLE_TAG + tagH;

  const artTop = 14;
  const artH = 630 - artTop;
  const blockTop = artTop + Math.round((artH - groupH) / 2) - 14;

  // Title baseline of line 1 (baseline ~0.80 of the font below the top).
  const titleBaseY = blockTop + Math.round(nameFont * 0.8);
  const nameTspans = nameLines
    .map((l, i) => `<tspan x="${TEXT_X}" dy="${i === 0 ? 0 : nameLH}">${esc(l)}</tspan>`)
    .join("");

  const taglineBaseY = blockTop + titleH + GAP_TITLE_TAG + Math.round(tagFont * 0.8);
  const taglineTspans = tagLines
    .map((l, i) => `<tspan x="${TEXT_X}" dy="${i === 0 ? 0 : tagLH}">${esc(l)}</tspan>`)
    .join("");

  // Bottom row (fixed): badges bottom-left, domain bottom-right.
  const bottomY = 566;

  // Icon: vertically centred against the TITLE block, so it reads as paired
  // with the name regardless of tagline length.
  const iconY = blockTop + Math.round(titleH / 2 - ICON / 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<!-- Tricolor top border: teal / amber / coral -->
<rect x="0" y="0" width="400" height="14" fill="#2f9d8d"/>
<rect x="400" y="0" width="400" height="14" fill="#e8b04b"/>
<rect x="800" y="0" width="400" height="14" fill="#d9594c"/>

<!-- Background -->
<rect width="1200" height="630" y="14" fill="#fafafa"/>

<!-- Junkyard scrap-tag icon (all apps) -->
${tagIcon(PAD_L, iconY, ICON)}

<!-- Title: Roboto Slab -->
<text y="${titleBaseY}" font-family="Roboto Slab" font-size="${nameFont}" font-weight="700" fill="#1a2530">${nameTspans}</text>

<!-- Tagline: Roboto -->
<text y="${taglineBaseY}" font-family="Roboto" font-size="${tagFont}" font-weight="400" fill="#4a5568">${taglineTspans}</text>

<!-- Bottom-left: feature badges -->
<text x="${PAD_L}" y="${bottomY}" font-family="Roboto" font-size="14" font-weight="600" fill="${accent}" letter-spacing="1.5">FREE&#160;&#160;·&#160;&#160;IN BROWSER&#160;&#160;·&#160;&#160;NO UPLOAD</text>

<!-- Bottom-right: domain -->
<text x="${1200 - PAD_L}" y="${bottomY}" text-anchor="end" font-family="Roboto" font-size="15" font-weight="500" fill="#8a9199">junkyard.sh/${esc(slug)}</text>
</svg>`;
}

// ── Init WASM + load fonts ────────────────────────────────────────────
const wasmPath = pathToFileURL(
  join(ROOT, "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm"),
).href;
await initWasm(wasmPath);

// Load Roboto + Roboto Slab woff2 fonts from @fontsource
const fontBuffers: Uint8Array[] = [];
const fontPaths = [
  join(ROOT, "node_modules", "@fontsource", "roboto", "files", "roboto-latin-400-normal.woff2"),
  join(ROOT, "node_modules", "@fontsource", "roboto", "files", "roboto-latin-500-normal.woff2"),
  join(ROOT, "node_modules", "@fontsource", "roboto", "files", "roboto-latin-600-normal.woff2"),
  join(ROOT, "node_modules", "@fontsource", "roboto", "files", "roboto-latin-700-normal.woff2"),
  join(ROOT, "node_modules", "@fontsource", "roboto-slab", "files", "roboto-slab-latin-400-normal.woff2"),
  join(ROOT, "node_modules", "@fontsource", "roboto-slab", "files", "roboto-slab-latin-700-normal.woff2"),
];
for (const fp of fontPaths) {
  try {
    fontBuffers.push(new Uint8Array(readFileSync(fp)));
  } catch {
    process.stderr.write(`WARNING: Font not found: ${fp}\n`);
  }
}

if (fontBuffers.length === 0) {
  process.stderr.write("ERROR: No fonts found. Run: bun add @fontsource/roboto @fontsource/roboto-slab\n");
  process.exit(1);
}

// ── Read apps ─────────────────────────────────────────────────────────
const appDirs = readdirSync(APPS_DIR).filter((name) => {
  try {
    return statSync(join(APPS_DIR, name)).isDirectory();
  } catch {
    return false;
  }
});

let generated = 0;
const warnings: string[] = [];

for (const dir of appDirs) {
  const tsPath = join(APPS_DIR, dir, "junkyard.ts");
  let mod: { app: Record<string, unknown> };

  try {
    mod = await import(pathToFileURL(tsPath).href);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`[${dir}] Failed to import: ${msg}`);
    continue;
  }

  const app = mod.app;
  if (!app || typeof app !== "object") {
    warnings.push(`[${dir}] Missing or invalid "app" export`);
    continue;
  }

  const name = app.name as string;
  const tagline = app.tagline as string;
  const category = app.category as string;
  const slug = app.slug as string;

  if (!name || !tagline || !category || !slug) {
    warnings.push(`[${dir}] Missing name/tagline/category/slug`);
    continue;
  }

  try {
    const svg = buildOgSvg(name, tagline, category, slug);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers,
        defaultFontFamily: "Roboto",
        loadSystemFonts: false,
      },
    });
    const pngBuffer = resvg.render().asPng();
    writeFileSync(join(APPS_DIR, dir, "public", "og.png"), pngBuffer);
    generated++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    warnings.push(`[${dir}] Render failed: ${msg}`);
  }
}

if (warnings.length > 0) {
  for (const w of warnings) process.stderr.write(`WARNING: ${w}\n`);
}
process.stdout.write(`generated ${generated} OG images (${warnings.length} warnings)\n`);
