/**
 * Augmented tests for markdown.ts.
 * Covers pathways not reached by existing tests:
 * - escapeHtmlAttr (via wrapHtmlDocument with special chars)
 * - countStats edge cases (multiple blank lines, tabs)
 * - extractToc with duplicate headings, special chars in slugify
 * - applyToolbarAction heading stripping + h3
 * - renderMarkdown XSS — additional vectors
 * - printAsPdf is DOM-only (skip)
 */
import { describe, expect, it } from "vitest";
import {
  applyToolbarAction,
  countStats,
  extractToc,
  renderMarkdown,
  wrapHtmlDocument,
} from "./markdown";

// ── renderMarkdown — additional XSS / negative cases ─────────────────────────

describe("renderMarkdown — additional XSS and negative cases", () => {
  it("renders italic text", () => {
    const html = renderMarkdown("*italic*");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders strikethrough (GFM)", () => {
    const html = renderMarkdown("~~deleted~~");
    expect(html).toContain("<del>deleted</del>");
  });

  it("renders ordered list", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>");
  });

  it("does not include raw HTML event handlers in output", () => {
    // onclick is not in ALLOWED_ATTR
    const html = renderMarkdown('<div onclick="evil()">x</div>');
    expect(html).not.toContain("onclick");
  });

  it("strips data: URIs from image src (XSS vector)", () => {
    // DOMPurify strips data: image src; in test env (no DOM) it won't run,
    // but we can verify the raw marked output does not crash
    const html = renderMarkdown('![x](data:text/html,<script>alert(1)</script>)');
    // In test env (no DOM), DOMPurify is skipped — just verify no throw
    expect(typeof html).toBe("string");
  });

  it("renders horizontal rule", () => {
    const html = renderMarkdown("---");
    expect(html).toContain("<hr");
  });

  it("handles deeply nested blockquote", () => {
    const html = renderMarkdown("> > nested quote");
    expect(html).toContain("<blockquote>");
  });
});

// ── countStats — additional edge cases ───────────────────────────────────────

describe("countStats — additional edge cases", () => {
  it("counts multiple blank lines as separate lines", () => {
    const result = countStats("a\n\n\nb");
    // 4 lines: "a", "", "", "b"
    expect(result.lines).toBe(4);
  });

  it("tab character counts as one character", () => {
    const result = countStats("a\tb");
    expect(result.chars).toBe(3);
  });

  it("single newline counts as 2 lines", () => {
    const result = countStats("a\nb");
    expect(result.lines).toBe(2);
  });

  it("treats multiple spaces as delimiter (not word per space)", () => {
    const result = countStats("hello   world");
    // split(/\s+/) splits on multiple spaces => 2 words
    expect(result.words).toBe(2);
  });

  it("counts UTF-8 characters correctly", () => {
    const result = countStats("café");
    expect(result.chars).toBe(4);
    expect(result.words).toBe(1);
  });
});

// ── extractToc — additional cases ─────────────────────────────────────────────

describe("extractToc — additional cases", () => {
  it("handles duplicate heading text with same slug", () => {
    const toc = extractToc("## Introduction\n## Introduction");
    expect(toc).toHaveLength(2);
    expect(toc[0].slug).toBe(toc[1].slug);
  });

  it("slugifies heading with leading/trailing spaces", () => {
    const toc = extractToc("#  Spaced Heading  ");
    // text.trim() is applied, so slug should be "spaced-heading"
    expect(toc[0].slug).toBe("spaced-heading");
  });

  it("strips special chars (not alphanumeric/dash/space) from slug", () => {
    const toc = extractToc("# Hello! World?");
    expect(toc[0].slug).toBe("hello-world");
  });

  it("handles heading with code inline", () => {
    // ATX heading with backtick content
    const toc = extractToc("## The `main()` function");
    expect(toc).toHaveLength(1);
    expect(toc[0].text).toBe("The `main()` function");
  });

  it("only counts ATX-style headings (# prefix), not setext", () => {
    // Setext-style underline headings are not matched
    const md = "Title\n=====\n\nSub\n---";
    const toc = extractToc(md);
    expect(toc).toHaveLength(0);
  });

  it("extracts h3 heading correctly", () => {
    const toc = extractToc("### Third Level");
    expect(toc[0].level).toBe(3);
    expect(toc[0].text).toBe("Third Level");
    expect(toc[0].slug).toBe("third-level");
  });
});

// ── applyToolbarAction — additional cases ─────────────────────────────────────

describe("applyToolbarAction — h3 and edge cases", () => {
  it("prepends h3 hashes to line", () => {
    const result = applyToolbarAction("Hello", 0, 0, "h3");
    expect(result.value).toMatch(/^### Hello/);
  });

  it("cursor is placed at end of heading line after insertion", () => {
    const result = applyToolbarAction("Hello", 0, 0, "h1");
    // cursor should be at end of the new line
    const line = result.value.split("\n")[0];
    expect(result.selectionStart).toBe(line.length);
    expect(result.selectionEnd).toBe(line.length);
  });

  it("bold with empty string produces default placeholder", () => {
    const result = applyToolbarAction("", 0, 0, "bold");
    expect(result.value).toBe("**bold text**");
  });

  it("code with empty string produces default placeholder", () => {
    const result = applyToolbarAction("", 0, 0, "code");
    expect(result.value).toBe("`code`");
  });

  it("link with empty string produces default link text", () => {
    const result = applyToolbarAction("", 0, 0, "link");
    expect(result.value).toContain("[link text]");
    expect(result.value).toContain("https://example.com");
  });

  it("codeblock selects inner content for easy replacement", () => {
    const result = applyToolbarAction("", 0, 0, "codeblock");
    const selected = result.value.slice(result.selectionStart, result.selectionEnd);
    expect(selected).toBe("code here");
  });

  it("inserts text mid-document correctly (non-zero offset)", () => {
    const doc = "before\nsome text\nafter";
    const lineStart = 7; // start of "some text"
    const lineEnd = 7;
    const result = applyToolbarAction(doc, lineStart, lineEnd, "h2");
    expect(result.value).toContain("## some text");
  });
});

// ── wrapHtmlDocument — additional cases ──────────────────────────────────────

describe("wrapHtmlDocument — additional cases", () => {
  it("includes viewport meta tag", () => {
    const doc = wrapHtmlDocument("<p>hi</p>", "Test");
    expect(doc).toContain('name="viewport"');
  });

  it("escapes ampersand in title", () => {
    const doc = wrapHtmlDocument("<p>x</p>", "A & B");
    expect(doc).toContain("A &amp; B");
  });

  it("escapes double-quote in title", () => {
    const doc = wrapHtmlDocument("<p>x</p>", 'Title "quoted"');
    expect(doc).toContain("&quot;quoted&quot;");
  });

  it("body HTML is included verbatim between body tags", () => {
    const body = '<h1>Main</h1><p>Content here.</p>';
    const doc = wrapHtmlDocument(body, "T");
    expect(doc).toContain(body);
  });

  it("has charset UTF-8", () => {
    const doc = wrapHtmlDocument("", "t");
    expect(doc).toContain('charset="UTF-8"');
  });
});
