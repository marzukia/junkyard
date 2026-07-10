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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPS_DIR = join(ROOT, "apps");

// ── Category accent colours ───────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  image: "#2f9d8d",
  text: "#5b8def",
  ai: "#a855f7",
  docs: "#e8b04b",
};

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
// Positioned at x=86, y=246, 66×71px (teal top + coral bottom)
const TAG_ICON = `<g transform="translate(86, 246) scale(2.03)">
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

// ── SVG template — reference layout ──────────────────────────────────
function buildOgSvg(name: string, tagline: string, category: string, slug: string): string {
  const accent = CATEGORY_COLORS[category] ?? "#2f9d8d";

  // Title: starts at x=217, y=255 (baseline)
  const nameLines = wrapText(name, 18);
  const nameFontSize = nameLines.length > 1 ? 48 : 60;
  const nameLineH = nameFontSize * 1.15;
  const titleBaseY = 305; // baseline of first line

  const nameTspans = nameLines
    .map((l, i) => `<tspan x="217" dy="${i === 0 ? 0 : nameLineH}">${esc(l)}</tspan>`)
    .join("");

  // Tagline: below title
  const taglineY = titleBaseY + nameLines.length * nameLineH + 30;
  const taglineLines = wrapText(tagline, 55);
  const taglineTspans = taglineLines
    .map((l, i) => `<tspan x="217" dy="${i === 0 ? 0 : 28}">${esc(l)}</tspan>`)
    .join("");

  // Feature badges: "FREE · IN BROWSER · NO UPLOAD"
  const badgeY = taglineY + taglineLines.length * 28 + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<!-- Tricolor top border: teal (0-399), amber (400-799), coral (800-1199) -->
<rect x="0" y="0" width="400" height="14" fill="#2f9d8d"/>
<rect x="400" y="0" width="400" height="14" fill="#e8b04b"/>
<rect x="800" y="0" width="400" height="14" fill="#d9594c"/>

<!-- Background -->
<rect width="1200" height="630" y="14" fill="#fafafa"/>

<!-- Tag icon at x=86, y=246 -->
${TAG_ICON}

<!-- Title: Roboto Slab, dark, x=217, y=305 baseline -->
<text y="${titleBaseY}" font-family="Roboto Slab" font-size="${nameFontSize}" font-weight="700" fill="#1a2530">${nameTspans}</text>

<!-- Tagline: Roboto, gray, x=217 -->
<text y="${taglineY}" font-family="Roboto" font-size="20" font-weight="400" fill="#4a5568">${taglineTspans}</text>

<!-- Feature badges: teal, small caps style -->
<text y="${badgeY}" font-family="Roboto" font-size="14" font-weight="600" fill="${accent}" letter-spacing="1.5">FREE  ·  IN BROWSER  ·  NO UPLOAD</text>

<!-- Footer: teal URL -->
<text x="80" y="562" font-family="Roboto" font-size="15" font-weight="500" fill="${accent}">junkyard.sh/${esc(slug)}</text>
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
