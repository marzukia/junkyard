/**
 * Tiny inline-markdown tokenizer for resume fields.
 *
 * Supported syntax:
 *   **bold**          → { type: "bold", text }
 *   *italic*          → { type: "italic", text }
 *   `code`            → { type: "code", text }
 *   [label](url)      → { type: "link", text, href }
 *   plain text        → { type: "text", text }
 *
 * No nesting. Runs left-to-right, first match wins.
 * Used for both the preview HTML renderer and the PDF run splitter.
 */

export type MdRun =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

// Order matters: bold before italic so ** isn't ambiguous
const PATTERNS: { re: RegExp; extract: (m: RegExpExecArray) => MdRun }[] = [
  {
    re: /\*\*(.+?)\*\*/,
    extract: (m) => ({ type: "bold", text: m[1] }),
  },
  {
    re: /\*(.+?)\*/,
    extract: (m) => ({ type: "italic", text: m[1] }),
  },
  {
    re: /`(.+?)`/,
    extract: (m) => ({ type: "code", text: m[1] }),
  },
  {
    re: /\[(.+?)\]\((.+?)\)/,
    extract: (m) => ({ type: "link", text: m[1], href: m[2] }),
  },
];

/**
 * Tokenize a single line of text into styled runs.
 * Returns an array of MdRun objects with no nesting.
 */
export function tokenizeLine(input: string): MdRun[] {
  const runs: MdRun[] = [];
  let remaining = input;

  while (remaining.length > 0) {
    let earliest: { index: number; run: MdRun; end: number } | null = null;

    for (const { re, extract } of PATTERNS) {
      const m = re.exec(remaining);
      if (m !== null) {
        const end = m.index + m[0].length;
        if (earliest === null || m.index < earliest.index) {
          earliest = { index: m.index, run: extract(m), end };
        }
      }
    }

    if (earliest === null) {
      // No more patterns found – rest is plain text
      runs.push({ type: "text", text: remaining });
      break;
    }

    // Plain text before the match
    if (earliest.index > 0) {
      runs.push({ type: "text", text: remaining.slice(0, earliest.index) });
    }

    runs.push(earliest.run);
    remaining = remaining.slice(earliest.end);
  }

  return runs;
}

/**
 * Escape a string for safe insertion into HTML text content.
 * Only escapes characters that are meaningful in HTML.
 */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render a tokenized line to an HTML string using a minimal safe allowlist:
 * <strong>, <em>, <code>, <a href="..."> (https/http only).
 * All text content is escaped.
 */
export function runsToHtml(runs: MdRun[]): string {
  return runs
    .map((run) => {
      switch (run.type) {
        case "bold":
          return `<strong>${escHtml(run.text)}</strong>`;
        case "italic":
          return `<em>${escHtml(run.text)}</em>`;
        case "code":
          return `<code>${escHtml(run.text)}</code>`;
        case "link": {
          // Only allow safe protocols
          const safe = /^https?:\/\//i.test(run.href);
          if (!safe) return escHtml(run.text);
          return `<a href="${escHtml(run.href)}" target="_blank" rel="noopener noreferrer">${escHtml(run.text)}</a>`;
        }
        default:
          return escHtml(run.text);
      }
    })
    .join("");
}

/**
 * Convenience: tokenize then render to safe HTML.
 */
export function mdToHtml(input: string): string {
  return runsToHtml(tokenizeLine(input));
}
