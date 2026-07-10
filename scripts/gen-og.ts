#!/usr/bin/env node
// Generates OG images (1200×630 PNG) for every app from catalogue data.
// Uses SVG → PNG via @resvg/resvg-wasm (pure WASM, no native deps).
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

const CATEGORY_LABELS: Record<string, string> = {
  image: "Image & Media",
  text: "Text & Code",
  ai: "In-browser AI",
  docs: "Docs & Utility",
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

// ── SVG template ──────────────────────────────────────────────────────
function buildOgSvg(name: string, tagline: string, category: string): string {
  const accent = CATEGORY_COLORS[category] ?? "#2f9d8d";
  const catLabel = CATEGORY_LABELS[category] ?? category;

  const nameLines = wrapText(name, 20);
  const nameFontSize = nameLines.length > 1 ? 56 : 72;
  const nameLineH = nameFontSize * 1.15;
  const nameBlockTop = 230;
  const nameBlockH = nameLines.length * nameLineH;

  const nameTspans = nameLines
    .map((l, i) => `<tspan x="100" dy="${i === 0 ? 0 : nameLineH}">${esc(l)}</tspan>`)
    .join("");

  const taglineLines = wrapText(tagline, 55);
  const taglineTspans = taglineLines
    .map((l, i) => `<tspan x="100" dy="${i === 0 ? 0 : 30}">${esc(l)}</tspan>`)
    .join("");

  const gridLines = [
    ...Array.from({ length: 13 }, (_, i) => `<line x1="${i * 100}" y1="0" x2="${i * 100}" y2="630"/>`),
    ...Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1200" y2="${i * 100}"/>`),
  ].join("");

  const badgeW = catLabel.length * 11 + 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#1a1e22"/>
    <stop offset="100%" stop-color="#0f1214"/>
  </linearGradient>
  <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="url(#bg)"/>
<g opacity="0.04" stroke="#fff" stroke-width="1">${gridLines}</g>
<ellipse cx="1050" cy="80" rx="300" ry="200" fill="url(#glow)"/>
<rect x="0" y="0" width="8" height="630" fill="${accent}" opacity="0.8"/>
<g transform="translate(100, 150)">
  <rect width="${badgeW}" height="32" rx="16" fill="${accent}" opacity="0.15"/>
  <text x="16" y="22" font-family="sans-serif" font-size="14" font-weight="500" fill="${accent}">${esc(catLabel)}</text>
</g>
<text y="${nameBlockTop}" font-family="sans-serif" font-size="${nameFontSize}" font-weight="800" fill="#fff" letter-spacing="-0.02em">${nameTspans}</text>
<text y="${nameBlockTop + nameBlockH + 36}" font-family="sans-serif" font-size="22" font-weight="400" fill="#fff" opacity="0.6">${taglineTspans}</text>
<rect x="0" y="598" width="1200" height="32" fill="#0a0c0e" opacity="0.5"/>
<text x="100" y="620" font-family="sans-serif" font-size="14" font-weight="500" fill="#fff" opacity="0.4">junkyard.sh</text>
<circle cx="1120" cy="80" r="24" fill="#e8b04b" opacity="0.3"/>
<circle cx="1090" cy="130" r="14" fill="#d9594c" opacity="0.25"/>
<circle cx="1150" cy="120" r="8" fill="${accent}" opacity="0.4"/>
</svg>`;
}

// ── Init WASM + load fonts ────────────────────────────────────────────
const wasmPath = pathToFileURL(
  join(ROOT, "node_modules", "@resvg", "resvg-wasm", "index_bg.wasm"),
).href;
await initWasm(wasmPath);

// Load DejaVu Sans font (available on most Linux CI runners)
const FONT_PATHS = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
];

const fontBuffers: Uint8Array[] = [];
let fontFamily = "sans-serif";
for (const fp of FONT_PATHS) {
  try {
    fontBuffers.push(new Uint8Array(readFileSync(fp)));
    // Extract font name from path for family matching
    if (fp.includes("DejaVu")) fontFamily = "DejaVu Sans";
    else if (fp.includes("FreeSans")) fontFamily = "FreeSans";
    break; // Use first available font
  } catch {
    // Font not found, try next
  }
}

if (fontBuffers.length === 0) {
  process.stderr.write("WARNING: No system fonts found — text may not render. Install dejavu-fonts or freefont.\n");
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

  if (!name || !tagline || !category) {
    warnings.push(`[${dir}] Missing name/tagline/category`);
    continue;
  }

  try {
    const svg = buildOgSvg(name, tagline, category);
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
      font: {
        fontBuffers,
        defaultFontFamily: fontFamily,
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
