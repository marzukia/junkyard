import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./renderMarkdown";

describe("renderMarkdown", () => {
  it("renders plain text as a paragraph", () => {
    expect(renderMarkdown("Hello world")).toBe("<p>Hello world</p>");
  });

  it("escapes HTML entities", () => {
    const out = renderMarkdown("<script>alert('xss')</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });

  it("renders bold", () => {
    expect(renderMarkdown("**bold** text")).toContain("<strong>bold</strong>");
  });

  it("renders italic", () => {
    expect(renderMarkdown("*italic* text")).toContain("<em>italic</em>");
  });

  it("renders inline code", () => {
    expect(renderMarkdown("use `const x = 1`")).toContain("<code>const x = 1</code>");
  });

  it("renders a fenced code block", () => {
    const input = "```js\nconsole.log('hi');\n```";
    const out = renderMarkdown(input);
    expect(out).toContain("<pre");
    expect(out).toContain("<code>");
    expect(out).toContain("console.log(&#39;hi&#39;);");
  });

  it("renders fenced code block with lang attribute", () => {
    const out = renderMarkdown("```python\nprint('x')\n```");
    expect(out).toContain('data-lang="python"');
  });

  it("renders h1 headers", () => {
    expect(renderMarkdown("# Title")).toBe("<h1>Title</h1>");
  });

  it("renders h2 headers", () => {
    expect(renderMarkdown("## Sub")).toBe("<h2>Sub</h2>");
  });

  it("renders h3 headers", () => {
    expect(renderMarkdown("### Deep")).toBe("<h3>Deep</h3>");
  });

  it("renders unordered list", () => {
    const out = renderMarkdown("- apple\n- banana");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>apple</li>");
    expect(out).toContain("<li>banana</li>");
  });

  it("renders ordered list", () => {
    const out = renderMarkdown("1. first\n2. second");
    expect(out).toContain("<ol>");
    expect(out).toContain("<li>first</li>");
    expect(out).toContain("<li>second</li>");
  });

  it("renders multiple paragraphs separated by blank lines", () => {
    const out = renderMarkdown("First paragraph.\n\nSecond paragraph.");
    expect(out).toContain("<p>First paragraph.</p>");
    expect(out).toContain("<p>Second paragraph.</p>");
  });

  it("does not process markdown inside code blocks", () => {
    const out = renderMarkdown("```\n**not bold**\n```");
    // Inside code blocks the raw text should be escaped, not rendered as bold
    expect(out).not.toContain("<strong>");
    expect(out).toContain("**not bold**");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("handles blank-line-only input", () => {
    expect(renderMarkdown("\n\n\n")).toBe("");
  });

  // Regression: ***x*** must produce well-nested <strong><em>x</em></strong>
  it("renders bold-italic (***) with correct tag nesting", () => {
    const out = renderMarkdown("***hello***");
    expect(out).toContain("<strong><em>hello</em></strong>");
    expect(out).not.toContain("<strong><em>hello</strong></em>");
  });

  // Regression: asterisks inside inline code must not become emphasis
  it("does not treat asterisks inside inline code as emphasis", () => {
    const out = renderMarkdown("`a**b**c`");
    // Should produce a <code> containing literal a**b**c, no <strong> inside
    expect(out).toContain("<code>a**b**c</code>");
    expect(out).not.toContain("<strong>");
  });
});
