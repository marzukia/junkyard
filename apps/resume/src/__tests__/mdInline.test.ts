import { describe, expect, it } from "vitest";
import { mdToHtml, runsToHtml, tokenizeLine } from "../lib/mdInline";

describe("tokenizeLine", () => {
  it("returns plain text run for text with no markup", () => {
    expect(tokenizeLine("hello world")).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("parses bold", () => {
    const runs = tokenizeLine("say **hello** there");
    expect(runs).toEqual([
      { type: "text", text: "say " },
      { type: "bold", text: "hello" },
      { type: "text", text: " there" },
    ]);
  });

  it("parses italic", () => {
    const runs = tokenizeLine("say *hi* there");
    expect(runs).toEqual([
      { type: "text", text: "say " },
      { type: "italic", text: "hi" },
      { type: "text", text: " there" },
    ]);
  });

  it("bold takes priority over italic (** before *)", () => {
    const runs = tokenizeLine("**bold** and *italic*");
    expect(runs[0]).toEqual({ type: "bold", text: "bold" });
    expect(runs[2]).toEqual({ type: "italic", text: "italic" });
  });

  it("parses inline code", () => {
    const runs = tokenizeLine("run `npm install` now");
    expect(runs).toEqual([
      { type: "text", text: "run " },
      { type: "code", text: "npm install" },
      { type: "text", text: " now" },
    ]);
  });

  it("parses links", () => {
    const runs = tokenizeLine("see [docs](https://example.com)");
    expect(runs).toEqual([
      { type: "text", text: "see " },
      { type: "link", text: "docs", href: "https://example.com" },
    ]);
  });

  it("handles multiple patterns in sequence", () => {
    const runs = tokenizeLine("**a** and *b* and `c`");
    expect(runs.map((r) => r.type)).toEqual(["bold", "text", "italic", "text", "code"]);
  });

  it("returns empty array for empty input", () => {
    expect(tokenizeLine("")).toEqual([]);
  });

  it("returns plain text when no patterns match", () => {
    const runs = tokenizeLine("no markup here");
    expect(runs).toHaveLength(1);
    expect(runs[0].type).toBe("text");
  });
});

describe("runsToHtml", () => {
  it("escapes HTML entities in plain text", () => {
    const html = runsToHtml([{ type: "text", text: "<script>alert(1)</script>" }]);
    expect(html).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("wraps bold in <strong>", () => {
    const html = runsToHtml([{ type: "bold", text: "hello" }]);
    expect(html).toBe("<strong>hello</strong>");
  });

  it("wraps italic in <em>", () => {
    const html = runsToHtml([{ type: "italic", text: "hi" }]);
    expect(html).toBe("<em>hi</em>");
  });

  it("wraps code in <code>", () => {
    const html = runsToHtml([{ type: "code", text: "foo()" }]);
    expect(html).toBe("<code>foo()</code>");
  });

  it("renders https links as <a>", () => {
    const html = runsToHtml([{ type: "link", text: "docs", href: "https://example.com" }]);
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("docs</a>");
  });

  it("blocks javascript: protocol in links", () => {
    const html = runsToHtml([{ type: "link", text: "evil", href: "javascript:alert(1)" }]);
    expect(html).toBe("evil");
    expect(html).not.toContain("javascript:");
  });

  it("escapes text inside formatted runs", () => {
    const html = runsToHtml([{ type: "bold", text: "<b>xss</b>" }]);
    expect(html).toBe("<strong>&lt;b&gt;xss&lt;/b&gt;</strong>");
  });
});

describe("mdToHtml (integration)", () => {
  it("converts a mixed line end-to-end", () => {
    const html = mdToHtml("Built **scalable** API with *10k* req/s");
    expect(html).toContain("<strong>scalable</strong>");
    expect(html).toContain("<em>10k</em>");
    expect(html).toContain("Built ");
    expect(html).toContain(" API with ");
    expect(html).toContain(" req/s");
  });

  it("does not introduce tags for plain text", () => {
    const html = mdToHtml("plain text only");
    expect(html).toBe("plain text only");
    expect(html).not.toContain("<");
  });
});
