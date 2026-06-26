/**
 * Pure subtitle parsing, serialisation and manipulation.
 * No DOM/browser deps — fully testable in Node/jsdom.
 */

export interface Cue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

// ── ID helper ────────────────────────────────────────────────────────────────

/**
 * Generate a unique cue ID.
 * Falls back to a random string when crypto.randomUUID is unavailable
 * (HTTP / local file / older runtimes).
 */
function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "cue-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Time helpers ─────────────────────────────────────────────────────────────

/** Parse "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" (VTT) → ms */
export function parseTimestamp(ts: string): number {
  // normalise separator
  const norm = ts.trim().replace(",", ".");
  const m = norm.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) throw new Error(`Invalid timestamp: "${ts}"`);
  return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1_000 + Number(m[4]);
}

/** ms → "HH:MM:SS,mmm" (SRT format) */
export function formatTimestampSrt(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const mil = clamped % 1_000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(mil)}`;
}

/** ms → "HH:MM:SS.mmm" (VTT format) */
export function formatTimestampVtt(ms: number): string {
  return formatTimestampSrt(ms).replace(",", ".");
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function pad3(n: number) {
  return String(n).padStart(3, "0");
}

// ── SRT parser ────────────────────────────────────────────────────────────────

const SRT_TIMING_RE = /^(\d+:\d{2}:\d{2}[,.]?\d{3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]?\d{3})/;

export function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = [];
  // split on blank lines (handle CRLF + LF)
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    // first line may be a sequence number
    let idx = 0;
    if (/^\d+$/.test(lines[0])) idx = 1;
    if (idx >= lines.length) continue;
    const timingMatch = lines[idx].match(SRT_TIMING_RE);
    if (!timingMatch) continue;
    try {
      const startMs = parseTimestamp(timingMatch[1]);
      const endMs = parseTimestamp(timingMatch[2]);
      const text = lines
        .slice(idx + 1)
        .join("\n")
        .trim();
      cues.push({ id: genId(), startMs, endMs, text });
    } catch {
      // skip malformed cue (e.g. timestamp missing separator)
    }
  }
  return cues;
}

// ── VTT parser ────────────────────────────────────────────────────────────────

const VTT_TIMING_RE =
  /^(\d+:\d{2}:\d{2}[,.]?\d{3}|\d+:\d{2}[,.]?\d{3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]?\d{3}|\d+:\d{2}[,.]?\d{3})/;

/** Parse short VTT timestamps like "MM:SS.mmm" (no hours component) → ms */
function parseVttTimestamp(ts: string): number {
  const norm = ts.trim().replace(",", ".");
  // strip VTT position/align settings that may follow the timestamp
  const clean = norm.split(/\s/)[0];
  // try HH:MM:SS.mmm first
  const long = clean.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/);
  if (long) {
    return (
      Number(long[1]) * 3_600_000 +
      Number(long[2]) * 60_000 +
      Number(long[3]) * 1_000 +
      Number(long[4])
    );
  }
  // MM:SS.mmm
  const short = clean.match(/^(\d+):(\d{2})\.(\d{3})$/);
  if (short) {
    return Number(short[1]) * 60_000 + Number(short[2]) * 1_000 + Number(short[3]);
  }
  throw new Error(`Invalid VTT timestamp: "${ts}"`);
}

export function parseVtt(raw: string): Cue[] {
  const cues: Cue[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  // skip WEBVTT header line and NOTE/STYLE/REGION blocks
  while (i < lines.length && !lines[i].startsWith("WEBVTT")) i++;
  i++; // past the WEBVTT line

  while (i < lines.length) {
    const line = lines[i].trim();
    // skip blank lines, NOTE/STYLE/REGION
    if (!line || line.startsWith("NOTE") || line.startsWith("STYLE") || line.startsWith("REGION")) {
      i++;
      continue;
    }
    // cue identifier (optional text before timing line)
    let cueId: string | null = null;
    if (!VTT_TIMING_RE.test(line)) {
      cueId = line;
      i++;
    }
    if (i >= lines.length) break;
    const timingLine = lines[i].trim();
    const timingMatch = timingLine.match(VTT_TIMING_RE);
    if (!timingMatch) {
      i++;
      continue;
    }
    const startMs = parseVttTimestamp(timingMatch[1]);
    const endMs = parseVttTimestamp(timingMatch[2]);
    i++;
    // collect text until blank line
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }
    const text = textLines.join("\n").trim();
    cues.push({ id: cueId ?? genId(), startMs, endMs, text });
  }
  return cues;
}

// ── ASS/SSA parser ────────────────────────────────────────────────────────────

/**
 * Parse ASS/SSA timestamp: H:MM:SS.cc (centiseconds, not ms)
 * e.g. "0:00:01.50" = 1500ms
 */
function parseAssTimestamp(ts: string): number {
  const m = ts.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) throw new Error(`Invalid ASS timestamp: "${ts}"`);
  return (
    Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1_000 + Number(m[4]) * 10
  );
}

/** ms → ASS/SSA timestamp "H:MM:SS.cc" */
export function formatTimestampAss(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const cs = Math.floor((clamped % 1_000) / 10);
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

/** Strip ASS inline override tags like {\an8} {\pos(x,y)} {\b1} etc. */
function stripAssTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n");
}

export function parseAss(raw: string): Cue[] {
  const cues: Cue[] = [];
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let inEvents = false;
  let formatFields: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "[Events]") {
      inEvents = true;
      continue;
    }
    if (trimmed.startsWith("[") && trimmed !== "[Events]") {
      inEvents = false;
      continue;
    }
    if (!inEvents) continue;

    if (trimmed.startsWith("Format:")) {
      formatFields = trimmed
        .slice(7)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      continue;
    }

    if (!trimmed.startsWith("Dialogue:")) continue;

    // Split on commas but respect the text field (last field, may contain commas)
    const rest = trimmed.slice(9); // remove "Dialogue:"
    const parts = rest.split(",");
    const startIdx = formatFields.indexOf("start");
    const endIdx = formatFields.indexOf("end");
    const textIdx = formatFields.indexOf("text");
    if (startIdx < 0 || endIdx < 0 || textIdx < 0) continue;

    try {
      const startMs = parseAssTimestamp(parts[startIdx]);
      const endMs = parseAssTimestamp(parts[endIdx]);
      // text field may contain commas — rejoin from textIdx onward
      const rawText = parts.slice(textIdx).join(",").trim();
      const text = stripAssTags(rawText);
      if (text) cues.push({ id: genId(), startMs, endMs, text });
    } catch {
      // skip malformed dialogue line
    }
  }

  // Sort by start time (ASS files can have non-chronological order)
  cues.sort((a, b) => a.startMs - b.startMs);
  return cues;
}

export function serialiseAss(cues: Cue[]): string {
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,40,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const dialogues = cues
    .map(
      (c) =>
        `Dialogue: 0,${formatTimestampAss(c.startMs)},${formatTimestampAss(c.endMs)},Default,,0,0,0,,${c.text.replace(/\n/g, "\\N")}`
    )
    .join("\n");
  return `${header}${dialogues}\n`;
}

// ── SBV parser ────────────────────────────────────────────────────────────────

/**
 * Parse SBV timestamp: H:MM:SS.mmm
 * SBV (YouTube SubViewer) uses dot separator and no space before -->
 */
function parseSbvTimestamp(ts: string): number {
  const m = ts.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) throw new Error(`Invalid SBV timestamp: "${ts}"`);
  return Number(m[1]) * 3_600_000 + Number(m[2]) * 60_000 + Number(m[3]) * 1_000 + Number(m[4]);
}

const SBV_TIMING_RE = /^(\d+:\d{2}:\d{2}\.\d{3}),(\d+:\d{2}:\d{2}\.\d{3})$/;

export function parseSbv(raw: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = raw
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    const timingMatch = lines[0].match(SBV_TIMING_RE);
    if (!timingMatch) continue;
    try {
      const startMs = parseSbvTimestamp(timingMatch[1]);
      const endMs = parseSbvTimestamp(timingMatch[2]);
      const text = lines.slice(1).join("\n").trim();
      if (text) cues.push({ id: genId(), startMs, endMs, text });
    } catch {
      // skip
    }
  }
  return cues;
}

/** ms → "H:MM:SS.mmm" (SBV format) */
function formatTimestampSbv(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1_000);
  const mil = clamped % 1_000;
  return `${h}:${pad2(m)}:${pad2(s)}.${pad3(mil)}`;
}

export function serialiseSbv(cues: Cue[]): string {
  return cues
    .map((c) => `${formatTimestampSbv(c.startMs)},${formatTimestampSbv(c.endMs)}\n${c.text}`)
    .join("\n\n")
    .concat("\n");
}

// ── Detect format from raw text ───────────────────────────────────────────────

export type SubFormat = "srt" | "vtt" | "ass" | "sbv";

export function detectFormat(raw: string): SubFormat {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("WEBVTT")) return "vtt";
  if (trimmed.startsWith("[Script Info]") || trimmed.startsWith("[V4")) return "ass";
  // SBV: first non-blank line matches H:MM:SS.mmm,H:MM:SS.mmm
  const firstLine = trimmed.split("\n")[0].trim();
  if (SBV_TIMING_RE.test(firstLine)) return "sbv";
  return "srt";
}

/** Return true if raw text looks like it might contain subtitle cues (quick check). */
export function mightContainSubtitles(raw: string): boolean {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("WEBVTT")) return true;
  if (trimmed.startsWith("[Script Info]") || trimmed.startsWith("[V4")) return true;
  // SRT-like: look for a --> anywhere in the first 2000 chars
  return /-->/m.test(trimmed.slice(0, 2000));
}

// ── Serialisers ───────────────────────────────────────────────────────────────

export function serialiseSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => {
      const timing = `${formatTimestampSrt(c.startMs)} --> ${formatTimestampSrt(c.endMs)}`;
      return `${i + 1}\n${timing}\n${c.text}`;
    })
    .join("\n\n")
    .concat("\n");
}

export function serialiseVtt(cues: Cue[]): string {
  const body = cues
    .map((c) => {
      const timing = `${formatTimestampVtt(c.startMs)} --> ${formatTimestampVtt(c.endMs)}`;
      return `${timing}\n${c.text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${body}\n`;
}

export function serialise(cues: Cue[], format: SubFormat): string {
  switch (format) {
    case "vtt":
      return serialiseVtt(cues);
    case "ass":
      return serialiseAss(cues);
    case "sbv":
      return serialiseSbv(cues);
    default:
      return serialiseSrt(cues);
  }
}

export function formatExtension(format: SubFormat): string {
  return format; // "srt" | "vtt" | "ass" | "sbv"
}

// ── Manipulation ──────────────────────────────────────────────────────────────

/** Shift all cues by deltaMs (can be negative). Clamps startMs to 0. */
export function shiftCues(cues: Cue[], deltaMs: number): Cue[] {
  return cues.map((c) => ({
    ...c,
    startMs: Math.max(0, c.startMs + deltaMs),
    endMs: Math.max(0, c.endMs + deltaMs),
  }));
}

/** Shift only the cues whose ids are in the selection set. */
export function shiftSelected(cues: Cue[], ids: Set<string>, deltaMs: number): Cue[] {
  return cues.map((c) =>
    ids.has(c.id)
      ? {
          ...c,
          startMs: Math.max(0, c.startMs + deltaMs),
          endMs: Math.max(0, c.endMs + deltaMs),
        }
      : c
  );
}

/**
 * Fix overlapping cues by pushing later cues forward so no cue starts
 * before the previous one ends. A 1 ms gap is inserted between them.
 */
export function fixOverlaps(cues: Cue[]): Cue[] {
  // Build an index to restore original order after overlap resolution.
  const indexed = cues.map((c, i) => ({ cue: c, origIdx: i }));
  // Sort by start time for overlap detection; use origIdx as tiebreaker to stay stable.
  const sorted = [...indexed].sort(
    (a, b) => a.cue.startMs - b.cue.startMs || a.origIdx - b.origIdx
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].cue;
    const cur = sorted[i].cue;
    if (cur.startMs < prev.endMs) {
      const duration = cur.endMs - cur.startMs;
      sorted[i] = {
        ...sorted[i],
        cue: {
          ...cur,
          startMs: prev.endMs + 1,
          endMs: prev.endMs + 1 + duration,
        },
      };
    }
  }
  // Restore original input order.
  const result = new Array(cues.length);
  for (const { cue, origIdx } of sorted) {
    result[origIdx] = cue;
  }
  return result;
}

/**
 * Two-point linear sync: given two reference points (subtitle time -> actual time),
 * compute a linear transform (scale + offset) and apply it to all cues.
 *
 * The transform is: t_out = t_in * scale + offset
 * where scale = (b_actual - a_actual) / (b_sub - a_sub)
 *       offset = a_actual - a_sub * scale
 */
export function linearSync(
  cues: Cue[],
  subA: number,
  actualA: number,
  subB: number,
  actualB: number
): Cue[] {
  if (subB === subA) {
    // Can't compute scale, fall back to simple offset
    const offset = actualA - subA;
    return shiftCues(cues, offset);
  }
  const scale = (actualB - actualA) / (subB - subA);
  const offset = actualA - subA * scale;
  return cues.map((c) => ({
    ...c,
    startMs: Math.max(0, Math.round(c.startMs * scale + offset)),
    endMs: Math.max(0, Math.round(c.endMs * scale + offset)),
  }));
}

/**
 * Find and replace text in cue text fields.
 * Returns new cues array; cues without matches are returned as-is (same reference).
 */
export function findReplace(
  cues: Cue[],
  pattern: string,
  replacement: string,
  useRegex: boolean,
  caseSensitive: boolean
): Cue[] {
  if (!pattern) return cues;
  let re: RegExp;
  try {
    const flags = `g${caseSensitive ? "" : "i"}`;
    re = useRegex ? new RegExp(pattern, flags) : new RegExp(escapeRegex(pattern), flags);
  } catch {
    return cues; // invalid regex — no-op
  }
  return cues.map((c) => {
    const next = c.text.replace(re, replacement);
    return next === c.text ? c : { ...c, text: next };
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Count total matches of a find pattern across all cue texts. */
export function countMatches(
  cues: Cue[],
  pattern: string,
  useRegex: boolean,
  caseSensitive: boolean
): number {
  if (!pattern) return 0;
  let re: RegExp;
  try {
    const flags = `g${caseSensitive ? "" : "i"}`;
    re = useRegex ? new RegExp(pattern, flags) : new RegExp(escapeRegex(pattern), flags);
  } catch {
    return 0;
  }
  let count = 0;
  for (const c of cues) {
    const m = c.text.match(re);
    if (m) count += m.length;
  }
  return count;
}
