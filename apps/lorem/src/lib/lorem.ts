// ── Lorem ipsum source corpus ────────────────────────────────────────────────
// Classic lorem ipsum words, extended with the full Cicero passage.

export const CLASSIC_START =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

const WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "in",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
  "excepteur",
  "sint",
  "occaecat",
  "cupidatat",
  "non",
  "proident",
  "sunt",
  "culpa",
  "qui",
  "officia",
  "deserunt",
  "mollit",
  "anim",
  "id",
  "est",
  "laborum",
  "at",
  "vero",
  "eos",
  "accusamus",
  "iusto",
  "odio",
  "dignissimos",
  "ducimus",
  "blanditiis",
  "praesentium",
  "voluptatum",
  "deleniti",
  "atque",
  "corrupti",
  "quos",
  "quas",
  "molestias",
  "excepturi",
  "similique",
  "perspiciatis",
  "unde",
  "omnis",
  "iste",
  "natus",
  "error",
  "voluptatem",
  "accusantium",
  "doloremque",
  "laudantium",
  "totam",
  "rem",
  "aperiam",
  "eaque",
  "ipsa",
  "ab",
  "illo",
  "inventore",
  "veritatis",
  "quasi",
  "architecto",
  "beatae",
  "vitae",
  "dicta",
  "explicabo",
  "nemo",
  "ipsam",
  "aspernatur",
  "aut",
  "odit",
  "fugit",
  "consequuntur",
  "magni",
  "dolores",
  "ratione",
  "sequi",
  "nesciunt",
  "neque",
  "porro",
  "quisquam",
  "esse",
  "nihil",
  "voluptas",
  "assumenda",
  "repudiandae",
  "itaque",
  "earum",
  "hic",
  "tenetur",
  "sapiente",
  "delectus",
  "reiciendis",
  "voluptatibus",
  "maiores",
  "alias",
  "perferendis",
  "doloribus",
  "temporibus",
  "quibusdam",
  "officiis",
  "debitis",
  "rerum",
  "necessitatibus",
  "saepe",
  "eveniet",
  "harum",
  "quidem",
  "expedita",
  "distinctio",
  "nam",
  "libero",
  "tempore",
  "cum",
  "soluta",
  "nobis",
  "eligendi",
  "optio",
  "cumque",
  "impedit",
  "minus",
  "quod",
  "maxime",
  "placeat",
  "facere",
  "possimus",
  "omnis",
  "voluptas",
  "assumenda",
  "repellendus",
];

// ── Themed word banks ────────────────────────────────────────────────────────

const BACON_WORDS = [
  "bacon",
  "pancetta",
  "prosciutto",
  "ham",
  "chorizo",
  "sausage",
  "salami",
  "pepperoni",
  "lardons",
  "bresaola",
  "capicola",
  "mortadella",
  "kielbasa",
  "andouille",
  "bratwurst",
  "smoked",
  "cured",
  "crispy",
  "savory",
  "meaty",
  "sizzling",
  "tender",
  "juicy",
  "pork",
  "beef",
  "turkey",
  "strip",
  "belly",
  "ribs",
  "loin",
  "chop",
  "rind",
  "fat",
  "grilled",
  "roasted",
  "glazed",
  "spiced",
  "marbled",
  "thick-cut",
  "shoulder",
];

const HIPSTER_WORDS = [
  "artisanal",
  "craft",
  "bespoke",
  "curated",
  "organic",
  "sustainable",
  "locally-sourced",
  "handcrafted",
  "small-batch",
  "single-origin",
  "cold-brew",
  "pour-over",
  "kombucha",
  "kale",
  "quinoa",
  "avocado",
  "sourdough",
  "heirloom",
  "farm-to-table",
  "umami",
  "distilled",
  "fermented",
  "reclaimed",
  "vintage",
  "analog",
  "vinyl",
  "fixie",
  "plaid",
  "flannel",
  "bearded",
  "typewriter",
  "mason-jar",
  "loft",
  "brooklyn",
  "podcast",
  "ethical",
  "authentic",
  "narrative",
  "workshop",
  "roastery",
];

const CORPORATE_WORDS = [
  "synergy",
  "leverage",
  "paradigm",
  "bandwidth",
  "deliverable",
  "scalable",
  "actionable",
  "disruptive",
  "ecosystem",
  "stakeholder",
  "agile",
  "pivot",
  "ideate",
  "iterate",
  "onboard",
  "circle-back",
  "touchpoint",
  "deep-dive",
  "boil-the-ocean",
  "move-the-needle",
  "low-hanging-fruit",
  "core-competency",
  "value-add",
  "go-to-market",
  "cross-functional",
  "end-to-end",
  "best-in-class",
  "thought-leader",
  "proactive",
  "holistic",
  "robust",
  "granular",
  "streamline",
  "empower",
  "accelerate",
  "optimize",
  "monetize",
  "align",
  "cadence",
  "runway",
];

export type WordBank = "classic" | "bacon" | "hipster" | "corporate";

function getWordList(bank: WordBank): string[] {
  switch (bank) {
    case "bacon":
      return BACON_WORDS;
    case "hipster":
      return HIPSTER_WORDS;
    case "corporate":
      return CORPORATE_WORDS;
    default:
      return WORDS;
  }
}

// Seeded PRNG so we can get reproducible results from a numeric seed.
// Uses a simple 32-bit Xorshift. Exported for tests.
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function pickWord(rng: () => number, wordList: string[] = WORDS): string {
  return wordList[Math.floor(rng() * wordList.length)];
}

// Capitalise first character of a string.
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Word generation ──────────────────────────────────────────────────────────

export function generateWords(count: number, seed: number, bank: WordBank = "classic"): string {
  const rng = makeRng(seed);
  const wordList = getWordList(bank);
  const words: string[] = [];
  for (let i = 0; i < count; i++) {
    words.push(pickWord(rng, wordList));
  }
  return words.join(" ");
}

// ── Sentence generation ──────────────────────────────────────────────────────

const SENTENCE_MIN_WORDS = 6;
const SENTENCE_MAX_WORDS = 16;

export function generateSentence(rng: () => number, wordList: string[] = WORDS): string {
  const len =
    SENTENCE_MIN_WORDS + Math.floor(rng() * (SENTENCE_MAX_WORDS - SENTENCE_MIN_WORDS + 1));
  const words: string[] = [];
  for (let i = 0; i < len; i++) {
    words.push(pickWord(rng, wordList));
  }
  // Occasional comma (25% chance after word 3+)
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0) {
      result.push(cap(words[i]));
    } else if (i > 2 && i < words.length - 1 && rng() < 0.25) {
      result.push(`${words[i]},`);
    } else {
      result.push(words[i]);
    }
  }
  return `${result.join(" ")}.`;
}

export function generateSentences(count: number, seed: number, bank: WordBank = "classic"): string {
  const rng = makeRng(seed);
  const wordList = getWordList(bank);
  const sentences: string[] = [];
  for (let i = 0; i < count; i++) {
    sentences.push(generateSentence(rng, wordList));
  }
  return sentences.join(" ");
}

// ── Paragraph generation ─────────────────────────────────────────────────────

const PARA_MIN_SENTENCES = 3;
const PARA_MAX_SENTENCES = 7;

export function generateParagraph(rng: () => number, wordList: string[] = WORDS): string {
  const len =
    PARA_MIN_SENTENCES + Math.floor(rng() * (PARA_MAX_SENTENCES - PARA_MIN_SENTENCES + 1));
  const sentences: string[] = [];
  for (let i = 0; i < len; i++) {
    sentences.push(generateSentence(rng, wordList));
  }
  return sentences.join(" ");
}

export function generateParagraphs(
  count: number,
  seed: number,
  bank: WordBank = "classic"
): string {
  const rng = makeRng(seed);
  const wordList = getWordList(bank);
  const paras: string[] = [];
  for (let i = 0; i < count; i++) {
    paras.push(generateParagraph(rng, wordList));
  }
  return paras.join("\n\n");
}

// ── List generation ──────────────────────────────────────────────────────────

const ITEM_MIN_WORDS = 3;
const ITEM_MAX_WORDS = 8;

export function generateListItem(rng: () => number, wordList: string[] = WORDS): string {
  const len = ITEM_MIN_WORDS + Math.floor(rng() * (ITEM_MAX_WORDS - ITEM_MIN_WORDS + 1));
  const words: string[] = [];
  for (let i = 0; i < len; i++) {
    words.push(pickWord(rng, wordList));
  }
  return cap(words.join(" "));
}

export function generateList(
  count: number,
  seed: number,
  ordered: boolean,
  bank: WordBank = "classic"
): string[] {
  const rng = makeRng(seed);
  const wordList = getWordList(bank);
  const items: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = generateListItem(rng, wordList);
    items.push(ordered ? `${i + 1}. ${text}` : `- ${text}`);
  }
  return items;
}

// ── Classic start prepend ────────────────────────────────────────────────────

// Prepends the canonical lorem ipsum opening sentence to paragraph/sentence output.
// Only used when mode is "paragraphs" or "sentences" and classicStart is enabled.
export function withClassicStart(
  output: string,
  mode: "paragraphs" | "sentences" | "words" | "list"
): string {
  if (!output) return output;
  if (mode === "paragraphs") {
    // Replace the first sentence of the first paragraph with the classic start.
    const paras = output.split("\n\n");
    const first = paras[0];
    // Strip first sentence (up to first period) and prepend classic.
    const rest = first.replace(/^[^.]+\.\s*/, "");
    // When the first paragraph has only one sentence, rest is empty and we would
    // silently discard the generated content. Preserve it by appending it instead.
    paras[0] = rest ? `${CLASSIC_START} ${rest}` : `${CLASSIC_START} ${first}`;
    return paras.join("\n\n");
  }
  if (mode === "sentences") {
    // Replace the first generated sentence with the classic start.
    // When only one sentence was generated there is nothing left after stripping
    // it, so append the generated sentence rather than silently dropping it.
    const rest = output.replace(/^[^.]+\.\s*/, "");
    if (rest) return `${CLASSIC_START} ${rest}`;
    // Single sentence: prepend classic start, keep the generated content too.
    return `${CLASSIC_START} ${output}`;
  }
  return output;
}

// ── HTML conversion for lorem output ────────────────────────────────────────

// Converts plain-text lorem output back to semantic HTML based on the mode
// it was generated with. Paragraphs become <p> tags, lists become <ul>/<ol>.
export function toLoremHtml(
  output: string,
  mode: "paragraphs" | "sentences" | "words" | "list",
  listStyle: "unordered" | "ordered"
): string {
  if (!output) return "";
  if (mode === "paragraphs") {
    return output
      .split("\n\n")
      .map((p) => `<p>${p.trim()}</p>`)
      .join("\n");
  }
  if (mode === "sentences" || mode === "words") {
    return `<p>${output}</p>`;
  }
  // list mode: items prefixed with "- " or "N. "
  const tag = listStyle === "ordered" ? "ol" : "ul";
  const items = output
    .split("\n")
    .map((line) => line.replace(/^[-\d]+[.) ] */, "").trim())
    .filter(Boolean)
    .map((item) => `  <li>${item}</li>`)
    .join("\n");
  return `<${tag}>\n${items}\n</${tag}>`;
}

// ── Placeholder image generation ─────────────────────────────────────────────

export interface PlaceholderConfig {
  width: number;
  height: number;
  bgColor: string;
  textColor: string;
  label: string;
}

// Validates a CSS hex colour (3 or 6 digits with #).
export function isValidHexColor(c: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c);
}

// Escape characters that are special in XML text content and attribute values.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Returns an SVG string for the placeholder.
export function renderPlaceholderSvg(cfg: PlaceholderConfig): string {
  const { width, height, bgColor, textColor, label } = cfg;
  const rawLabel = label.trim() !== "" ? label : `${width}x${height}`;
  const displayLabel = xmlEscape(rawLabel);
  const fontSize = Math.max(10, Math.min(32, Math.floor(Math.min(width, height) * 0.12)));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <text
    x="${width / 2}"
    y="${height / 2}"
    font-family="Roboto, system-ui, sans-serif"
    font-size="${fontSize}"
    font-weight="600"
    fill="${textColor}"
    text-anchor="middle"
    dominant-baseline="middle"
  >${displayLabel}</text>
</svg>`;
}

// Returns a PNG data URL by drawing the SVG onto an offscreen canvas.
// Returns null if canvas is unavailable (e.g. in tests).
export function renderPlaceholderPng(
  cfg: PlaceholderConfig,
  doc: Document = document
): Promise<string | null> {
  return new Promise((resolve) => {
    const svgStr = renderPlaceholderSvg(cfg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = doc.createElement("img");
    img.onload = () => {
      const canvas = doc.createElement("canvas");
      canvas.width = cfg.width;
      canvas.height = cfg.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// Returns the SVG as a data URI (usable in <img src="..."> or CSS url()).
export function placeholderSvgDataUri(cfg: PlaceholderConfig): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderPlaceholderSvg(cfg))}`;
}

// Builds an <img> tag string for the placeholder.
export function placeholderImgTag(
  cfg: PlaceholderConfig,
  format: "svg" | "png",
  pngDataUrl?: string
): string {
  const src = format === "png" && pngDataUrl ? pngDataUrl : placeholderSvgDataUri(cfg);
  const label = cfg.label.trim() !== "" ? cfg.label : `${cfg.width}x${cfg.height}`;
  return `<img src="${src}" width="${cfg.width}" height="${cfg.height}" alt="${label}">`;
}
