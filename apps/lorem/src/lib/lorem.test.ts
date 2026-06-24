import { describe, expect, it } from "vitest";
import {
  CLASSIC_START,
  generateList,
  generateParagraphs,
  generateSentence,
  generateSentences,
  generateWords,
  isValidHexColor,
  makeRng,
  placeholderImgTag,
  placeholderSvgDataUri,
  renderPlaceholderSvg,
  toLoremHtml,
  withClassicStart,
} from "./lorem";

describe("makeRng", () => {
  it("returns values in [0, 1)", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces deterministic output for the same seed", () => {
    const r1 = makeRng(99);
    const r2 = makeRng(99);
    for (let i = 0; i < 20; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("produces different output for different seeds", () => {
    const r1 = makeRng(1);
    const r2 = makeRng(2);
    const seq1 = Array.from({ length: 10 }, () => r1());
    const seq2 = Array.from({ length: 10 }, () => r2());
    expect(seq1).not.toEqual(seq2);
  });
});

describe("generateWords", () => {
  it("returns the requested word count", () => {
    const result = generateWords(5, 42);
    const words = result.split(" ");
    expect(words.length).toBe(5);
  });

  it("returns non-empty string for count 1", () => {
    expect(generateWords(1, 1).length).toBeGreaterThan(0);
  });

  it("is deterministic with same seed", () => {
    expect(generateWords(10, 7)).toBe(generateWords(10, 7));
  });

  it("differs with different seed", () => {
    expect(generateWords(10, 1)).not.toBe(generateWords(10, 2));
  });
});

describe("generateSentence", () => {
  it("ends with a period", () => {
    const rng = makeRng(42);
    const s = generateSentence(rng);
    expect(s.endsWith(".")).toBe(true);
  });

  it("starts with a capital letter", () => {
    const rng = makeRng(42);
    const s = generateSentence(rng);
    expect(s[0]).toBe(s[0].toUpperCase());
  });

  it("contains at least 6 words", () => {
    const rng = makeRng(42);
    const s = generateSentence(rng);
    const words = s.replace(/,/g, "").replace(/\.$/, "").split(" ");
    expect(words.length).toBeGreaterThanOrEqual(6);
  });
});

describe("generateSentences", () => {
  it("generates the requested number of sentences", () => {
    const result = generateSentences(3, 42);
    const count = (result.match(/\./g) || []).length;
    expect(count).toBe(3);
  });

  it("is deterministic with same seed", () => {
    expect(generateSentences(5, 100)).toBe(generateSentences(5, 100));
  });
});

describe("generateParagraphs", () => {
  it("generates the requested number of paragraphs separated by double newline", () => {
    const result = generateParagraphs(3, 42);
    const paras = result.split("\n\n");
    expect(paras.length).toBe(3);
  });

  it("each paragraph ends with a period", () => {
    const result = generateParagraphs(2, 1);
    const paras = result.split("\n\n");
    for (const p of paras) {
      expect(p.trimEnd().endsWith(".")).toBe(true);
    }
  });

  it("is deterministic with same seed", () => {
    expect(generateParagraphs(4, 77)).toBe(generateParagraphs(4, 77));
  });
});

describe("generateList", () => {
  it("returns the requested item count", () => {
    const items = generateList(5, 42, false);
    expect(items.length).toBe(5);
  });

  it("unordered items start with a dash", () => {
    const items = generateList(3, 1, false);
    for (const item of items) {
      expect(item.startsWith("- ")).toBe(true);
    }
  });

  it("ordered items start with sequential numbers", () => {
    const items = generateList(3, 1, true);
    expect(items[0].startsWith("1.")).toBe(true);
    expect(items[1].startsWith("2.")).toBe(true);
    expect(items[2].startsWith("3.")).toBe(true);
  });

  it("is deterministic with same seed", () => {
    expect(generateList(4, 42, true)).toEqual(generateList(4, 42, true));
  });
});

describe("isValidHexColor", () => {
  it("accepts 6-digit hex with hash", () => {
    expect(isValidHexColor("#2f9d8d")).toBe(true);
  });

  it("accepts 3-digit hex with hash", () => {
    expect(isValidHexColor("#fff")).toBe(true);
  });

  it("rejects hex without hash", () => {
    expect(isValidHexColor("2f9d8d")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isValidHexColor("#zzzzzz")).toBe(false);
  });

  it("rejects 5-digit hex", () => {
    expect(isValidHexColor("#12345")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("renderPlaceholderSvg", () => {
  it("embeds width and height as attributes", () => {
    const svg = renderPlaceholderSvg({
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#000000",
      label: "",
    });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="300"');
  });

  it("uses label text when provided", () => {
    const svg = renderPlaceholderSvg({
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#333333",
      label: "Hero Image",
    });
    expect(svg).toContain("Hero Image");
  });

  it("falls back to WxH label when label is empty", () => {
    const svg = renderPlaceholderSvg({
      width: 800,
      height: 600,
      bgColor: "#eeeeee",
      textColor: "#000000",
      label: "",
    });
    expect(svg).toContain("800x600");
  });

  it("embeds background colour", () => {
    const svg = renderPlaceholderSvg({
      width: 100,
      height: 100,
      bgColor: "#ff0000",
      textColor: "#ffffff",
      label: "",
    });
    expect(svg).toContain('fill="#ff0000"');
  });

  it("produces valid SVG opening tag", () => {
    const svg = renderPlaceholderSvg({
      width: 100,
      height: 100,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: "",
    });
    expect(svg.trimStart()).toMatch(/^<svg /);
  });

  it("XML-escapes label so closing tags cannot break SVG structure", () => {
    const svg = renderPlaceholderSvg({
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#000000",
      label: "</text></svg><script>alert(1)</script>",
    });
    // The injected closing tags must be escaped, not literal
    expect(svg).not.toContain("</text></svg><script>");
    expect(svg).toContain("&lt;/text&gt;");
    // The SVG must still close properly
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });

  it("XML-escapes ampersands and quotes in label", () => {
    const svg = renderPlaceholderSvg({
      width: 200,
      height: 100,
      bgColor: "#ffffff",
      textColor: "#000000",
      label: 'A & B "quoted"',
    });
    expect(svg).toContain("A &amp; B &quot;quoted&quot;");
  });
});

describe("toLoremHtml", () => {
  it("returns empty string for empty output", () => {
    expect(toLoremHtml("", "paragraphs", "unordered")).toBe("");
  });

  it("wraps paragraphs in <p> tags, one per double-newline block", () => {
    const input = "First paragraph.\n\nSecond paragraph.";
    const result = toLoremHtml(input, "paragraphs", "unordered");
    expect(result).toBe("<p>First paragraph.</p>\n<p>Second paragraph.</p>");
  });

  it("wraps sentences in a single <p>", () => {
    const input = "Sentence one. Sentence two.";
    expect(toLoremHtml(input, "sentences", "unordered")).toBe("<p>Sentence one. Sentence two.</p>");
  });

  it("wraps words in a single <p>", () => {
    expect(toLoremHtml("lorem ipsum dolor", "words", "unordered")).toBe("<p>lorem ipsum dolor</p>");
  });

  it("renders unordered list as <ul> with <li> items", () => {
    const input = "- Alpha\n- Beta\n- Gamma";
    const result = toLoremHtml(input, "list", "unordered");
    expect(result).toContain("<ul>");
    expect(result).toContain("</ul>");
    expect(result).toContain("<li>Alpha</li>");
    expect(result).toContain("<li>Beta</li>");
    expect(result).not.toContain("<ol>");
  });

  it("renders ordered list as <ol> with <li> items, strips numeric prefix", () => {
    const input = "1. Alpha\n2. Beta\n3. Gamma";
    const result = toLoremHtml(input, "list", "ordered");
    expect(result).toContain("<ol>");
    expect(result).toContain("</ol>");
    expect(result).toContain("<li>Alpha</li>");
    expect(result).not.toContain("<ul>");
  });
});

describe("themed word banks", () => {
  it("bacon bank produces bacon-flavoured words", () => {
    const result = generateWords(20, 42, "bacon");
    // All words should come from the bacon list
    expect(result).toMatch(/bacon|pancetta|chorizo|salami|prosciutto|ham/i);
  });

  it("hipster bank produces hipster-flavoured words", () => {
    const result = generateWords(20, 42, "hipster");
    expect(result).toMatch(/artisanal|craft|bespoke|kombucha|avocado|organic/i);
  });

  it("corporate bank produces corporate-flavoured words", () => {
    const result = generateWords(20, 42, "corporate");
    expect(result).toMatch(/synergy|leverage|paradigm|agile|scalable/i);
  });

  it("classic bank produces classic lorem ipsum words", () => {
    const result = generateWords(20, 42, "classic");
    expect(result).toMatch(/lorem|ipsum|dolor|consectetur|adipiscing/i);
  });

  it("generateParagraphs respects word bank", () => {
    const result = generateParagraphs(1, 42, "bacon");
    expect(result).toMatch(/bacon|pancetta|chorizo|salami|prosciutto/i);
  });

  it("generateSentences respects word bank", () => {
    const result = generateSentences(2, 42, "corporate");
    expect(result).toMatch(/synergy|leverage|paradigm|agile|scalable|disruptive/i);
  });

  it("generateList respects word bank", () => {
    const items = generateList(3, 42, false, "hipster");
    const joined = items.join(" ");
    expect(joined).toMatch(/artisanal|craft|bespoke|organic/i);
  });
});

describe("withClassicStart", () => {
  it("replaces first sentence of paragraphs with classic start", () => {
    const text = generateParagraphs(2, 99);
    const result = withClassicStart(text, "paragraphs");
    expect(result.startsWith(CLASSIC_START)).toBe(true);
    // Should still have two paragraphs
    expect(result.split("\n\n").length).toBe(2);
  });

  it("replaces first sentence of sentences mode with classic start", () => {
    const text = generateSentences(3, 99);
    const result = withClassicStart(text, "sentences");
    expect(result.startsWith(CLASSIC_START)).toBe(true);
  });

  it("does not modify words mode output", () => {
    const text = generateWords(10, 99);
    const result = withClassicStart(text, "words");
    expect(result).toBe(text);
  });

  it("does not modify list mode output", () => {
    const items = generateList(3, 99, false).join("\n");
    const result = withClassicStart(items, "list");
    expect(result).toBe(items);
  });

  // Regression: count=1 sentences mode must not drop the generated sentence
  it("sentences count=1 includes generated content alongside classic start", () => {
    const oneSentence = generateSentences(1, 42);
    const result = withClassicStart(oneSentence, "sentences");
    expect(result.startsWith(CLASSIC_START)).toBe(true);
    // The result must be longer than just the classic start - generated content preserved
    expect(result.length).toBeGreaterThan(CLASSIC_START.length);
  });

  // Regression: count=1 paragraphs mode must not drop the generated paragraph
  it("paragraphs count=1 includes generated content alongside classic start", () => {
    const onePara = generateParagraphs(1, 42);
    const result = withClassicStart(onePara, "paragraphs");
    expect(result.startsWith(CLASSIC_START)).toBe(true);
    expect(result.length).toBeGreaterThan(CLASSIC_START.length);
  });
});

describe("placeholderSvgDataUri", () => {
  it("returns a data URI starting with the SVG mime type", () => {
    const uri = placeholderSvgDataUri({
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#333333",
      label: "",
    });
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
  });

  it("encodes the SVG content", () => {
    const cfg = {
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#333333",
      label: "Test",
    };
    const uri = placeholderSvgDataUri(cfg);
    const decoded = decodeURIComponent(uri.replace("data:image/svg+xml;charset=utf-8,", ""));
    expect(decoded).toContain("Test");
  });
});

describe("placeholderImgTag", () => {
  it("generates an img tag with correct width and height", () => {
    const cfg = { width: 800, height: 600, bgColor: "#cccccc", textColor: "#333333", label: "" };
    const tag = placeholderImgTag(cfg, "svg");
    expect(tag).toContain('width="800"');
    expect(tag).toContain('height="600"');
    expect(tag).toMatch(/^<img /);
  });

  it("uses label as alt text when provided", () => {
    const cfg = {
      width: 400,
      height: 300,
      bgColor: "#cccccc",
      textColor: "#333333",
      label: "Hero",
    };
    const tag = placeholderImgTag(cfg, "svg");
    expect(tag).toContain('alt="Hero"');
  });

  it("falls back to WxH as alt text when label is empty", () => {
    const cfg = { width: 800, height: 600, bgColor: "#cccccc", textColor: "#333333", label: "" };
    const tag = placeholderImgTag(cfg, "svg");
    expect(tag).toContain('alt="800x600"');
  });

  it("uses provided PNG data URL when format is png", () => {
    const cfg = { width: 400, height: 300, bgColor: "#cccccc", textColor: "#333333", label: "" };
    const pngUrl = "data:image/png;base64,abc123";
    const tag = placeholderImgTag(cfg, "png", pngUrl);
    expect(tag).toContain(pngUrl);
  });
});
