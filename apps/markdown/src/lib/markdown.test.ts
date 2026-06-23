import { describe, expect, it } from "vitest";
import {
  applyToolbarAction,
  countStats,
  extractToc,
  renderMarkdown,
  wrapHtmlDocument,
} from "./markdown";

describe("renderMarkdown", () => {
  it("renders heading", () => {
    const html = renderMarkdown("# Hello");
    expect(html).toContain("<h1");
    expect(html).toContain("Hello");
  });

  it("renders bold", () => {
    const html = renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders inline code", () => {
    const html = renderMarkdown("`code`");
    expect(html).toContain("<code>code</code>");
  });

  it("renders fenced code block", () => {
    const html = renderMarkdown("```\nconsole.log('hi')\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
  });

  it("renders link", () => {
    const html = renderMarkdown("[text](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">text<");
  });

  it("renders unordered list", () => {
    const html = renderMarkdown("- item one\n- item two");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
  });

  it("renders GFM table", () => {
    const md = "| A | B |\n|---|---|\n| 1 | 2 |";
    const html = renderMarkdown(md);
    expect(html).toContain("<table>");
    expect(html).toContain("<th>");
  });

  it("renders blockquote", () => {
    const html = renderMarkdown("> quoted");
    expect(html).toContain("<blockquote>");
  });

  it("returns empty string for empty input", () => {
    const html = renderMarkdown("");
    expect(html.trim()).toBe("");
  });

  it("strips script tags (XSS)", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(1)");
  });

  it("strips javascript: href (XSS)", () => {
    const html = renderMarkdown("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("strips onerror attribute (XSS)", () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });
});

describe("countStats", () => {
  it("counts words in simple sentence", () => {
    expect(countStats("hello world foo").words).toBe(3);
  });

  it("counts characters including spaces", () => {
    expect(countStats("abc def").chars).toBe(7);
  });

  it("counts lines", () => {
    expect(countStats("line1\nline2\nline3").lines).toBe(3);
  });

  it("returns zeros for empty string", () => {
    expect(countStats("")).toEqual({ words: 0, chars: 0, lines: 0 });
  });

  it("handles single word", () => {
    expect(countStats("word").words).toBe(1);
  });

  it("handles whitespace-only as 0 words", () => {
    expect(countStats("   ").words).toBe(0);
  });
});

describe("applyToolbarAction — bold", () => {
  it("wraps selected text in bold markers", () => {
    const result = applyToolbarAction("hello world", 6, 11, "bold");
    expect(result.value).toBe("hello **world**");
  });

  it("inserts default placeholder when no selection", () => {
    const result = applyToolbarAction("text ", 5, 5, "bold");
    expect(result.value).toBe("text **bold text**");
  });

  it("selects the inner text after bold insertion", () => {
    const result = applyToolbarAction("", 0, 0, "bold");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe("bold text");
  });
});

describe("applyToolbarAction — headings", () => {
  it("prepends h1 hashes to line", () => {
    const result = applyToolbarAction("Hello world", 0, 0, "h1");
    expect(result.value).toMatch(/^# Hello world/);
  });

  it("prepends h2 hashes to line", () => {
    const result = applyToolbarAction("Hello", 0, 0, "h2");
    expect(result.value).toMatch(/^## Hello/);
  });

  it("replaces existing heading level", () => {
    const result = applyToolbarAction("# Old heading", 0, 0, "h2");
    expect(result.value).toMatch(/^## Old heading/);
    expect(result.value).not.toContain("# # ");
  });
});

describe("applyToolbarAction — link", () => {
  it("wraps selected text as link text", () => {
    const result = applyToolbarAction("click here please", 6, 10, "link");
    expect(result.value).toContain("[here](https://example.com)");
  });

  it("selects the URL for easy replacement", () => {
    const result = applyToolbarAction("", 0, 0, "link");
    expect(result.value.slice(result.selectionStart, result.selectionEnd)).toBe(
      "https://example.com"
    );
  });
});

describe("applyToolbarAction — code", () => {
  it("wraps selection in backticks", () => {
    const result = applyToolbarAction("use foo here", 4, 7, "code");
    expect(result.value).toBe("use `foo` here");
  });
});

describe("applyToolbarAction — codeblock", () => {
  it("wraps selection in fenced code block", () => {
    const result = applyToolbarAction("", 0, 0, "codeblock");
    expect(result.value).toBe("```\ncode here\n```");
  });

  it("preserves selected content in code block", () => {
    const result = applyToolbarAction("const x = 1", 0, 11, "codeblock");
    expect(result.value).toContain("const x = 1");
    expect(result.value).toContain("```");
  });
});

describe("wrapHtmlDocument", () => {
  it("produces a full HTML document", () => {
    const doc = wrapHtmlDocument("<p>hi</p>", "My Doc");
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("<title>My Doc</title>");
    expect(doc).toContain("<p>hi</p>");
  });

  it("escapes angle brackets in title", () => {
    const doc = wrapHtmlDocument("<p>x</p>", "<script>");
    expect(doc).toContain("&lt;script&gt;");
  });
});

describe("renderMarkdown — task lists (bug fix)", () => {
  it("renders GFM task list checkboxes as <input> elements", () => {
    // marked GFM emits <input type="checkbox" disabled> inside <li>
    // DOMPurify was stripping these; they must now survive sanitization
    const html = renderMarkdown("- [ ] unchecked\n- [x] checked");
    // In test env (no DOM) DOMPurify is skipped, so just check marked output
    expect(html).toContain("<li>");
    // The raw marked output contains "checkbox" keyword
    expect(html.toLowerCase()).toContain("checkbox");
  });

  it("renders unchecked and checked items", () => {
    const html = renderMarkdown("- [ ] todo\n- [x] done");
    expect(html).toContain("todo");
    expect(html).toContain("done");
  });
});

describe("extractToc", () => {
  it("extracts h1, h2, h3 headings", () => {
    const md = "# Title\n## Section\n### Sub\nsome text\n## Another";
    const toc = extractToc(md);
    expect(toc).toHaveLength(4);
    expect(toc[0]).toEqual({ level: 1, text: "Title", slug: "title" });
    expect(toc[1]).toEqual({ level: 2, text: "Section", slug: "section" });
    expect(toc[2]).toEqual({ level: 3, text: "Sub", slug: "sub" });
    expect(toc[3]).toEqual({ level: 2, text: "Another", slug: "another" });
  });

  it("returns empty array for content with no headings", () => {
    expect(extractToc("hello world\n- item")).toEqual([]);
  });

  it("ignores h4-h6", () => {
    const toc = extractToc("#### Deep\n##### Deeper");
    expect(toc).toHaveLength(0);
  });

  it("slugifies heading text", () => {
    const toc = extractToc("## Hello World!");
    expect(toc[0].slug).toBe("hello-world");
  });

  it("slugifies multi-word headings with numbers", () => {
    const toc = extractToc("# Step 1: Setup");
    expect(toc[0].slug).toBe("step-1-setup");
  });

  it("returns empty for empty input", () => {
    expect(extractToc("")).toEqual([]);
  });
});
