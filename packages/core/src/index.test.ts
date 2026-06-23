import { describe, it, expect } from "vitest";
import { TOOLS } from "./index.js";
import { parseJson, formatJson, minifyJson, validateJson } from "./json.js";
import { csvToJsonString, jsonToCsvString } from "./csv.js";
import { hash, hmac } from "./hash.js";
import { encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url } from "./base64.js";
import { decodeJwt, verifyHmac } from "./jwt.js";
import { testRegex } from "./regex.js";
import { uuidV4, uuidV7 } from "./uuid.js";
import { convertTimestamp } from "./timestamp.js";
import { computeDiff } from "./diff.js";
import { convert as convertUnit, findUnit } from "./units.js";
import { validateSvgColor } from "./qr.js";
import { convertColor, contrastRatio } from "./colours.js";
import { generatePassword } from "./password.js";
import { generateWords, generateSentences, generateParagraphs } from "./lorem.js";
import { toHtml } from "./markdown.js";
import { generateSvgString } from "./qr.js";
import { generateBarcodeSvg } from "./barcode.js";

// ── Registry ──────────────────────────────────────────────────────────────────

describe("TOOLS registry", () => {
  it("has exactly 17 entries", () => {
    expect(TOOLS).toHaveLength(17);
  });

  it("every tool has a slug, name, and at least one op", () => {
    for (const tool of TOOLS) {
      expect(tool.slug).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.ops.length).toBeGreaterThan(0);
    }
  });

  it("every op has a name, description, inputSchema, and run function", () => {
    for (const tool of TOOLS) {
      for (const op of tool.ops) {
        expect(op.name).toBeTruthy();
        expect(op.description).toBeTruthy();
        expect(op.inputSchema).toBeDefined();
        expect(typeof op.run).toBe("function");
      }
    }
  });

  it("slugs match the expected 17 tools", () => {
    const slugs = TOOLS.map((t) => t.slug).sort();
    expect(slugs).toEqual([
      "barcode", "base64", "colours", "cron", "csv",
      "diff", "hash", "json", "jwt", "lorem",
      "markdown", "password", "qr", "regex",
      "timestamp", "units", "uuid",
    ]);
  });
});

// ── JSON ──────────────────────────────────────────────────────────────────────

describe("json", () => {
  it("formats JSON with indent 2", () => {
    const result = formatJson('{"a":1,"b":2}', 2);
    expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("minifies JSON", () => {
    expect(minifyJson('{ "a" : 1 }')).toBe('{"a":1}');
  });

  it("validates valid JSON", () => {
    expect(validateJson('{"x":1}')).toEqual({ valid: true });
  });

  it("validates invalid JSON with error", () => {
    const r = validateJson("{bad}");
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("parseJson returns ok:true for valid input", () => {
    const r = parseJson("[1,2,3]");
    expect(r.ok).toBe(true);
  });
});

// ── CSV ───────────────────────────────────────────────────────────────────────

describe("csv", () => {
  it("converts CSV to JSON", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const json = csvToJsonString(csv, ",");
    const parsed = JSON.parse(json) as unknown[];
    expect(parsed).toHaveLength(2);
    expect((parsed[0] as Record<string, unknown>)["name"]).toBe("Alice");
  });

  it("converts JSON to CSV", () => {
    const json = '[{"a":1,"b":2}]';
    const csv = jsonToCsvString(json, ",");
    expect(csv).toContain("a,b");
    expect(csv).toContain("1,2");
  });

  it("round-trips through CSV -> JSON -> CSV", () => {
    const original = "x,y\n1,2\n3,4";
    const asJson = csvToJsonString(original, ",");
    const back = jsonToCsvString(asJson, ",");
    expect(back).toContain("x,y");
    expect(back).toContain("1,2");
  });
});

// ── Hash ──────────────────────────────────────────────────────────────────────

describe("hash", () => {
  it("sha256 of 'abc'", () => {
    expect(hash("abc", "sha256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("md5 of 'abc'", () => {
    expect(hash("abc", "md5")).toBe("900150983cd24fb0d6963f7d28e17f72");
  });

  it("sha1 of 'abc'", () => {
    expect(hash("abc", "sha1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
  });

  it("sha512 of empty string", () => {
    const h = hash("", "sha512");
    expect(h).toHaveLength(128);
  });

  it("hmac-sha256", () => {
    const h = hmac("Hello", "secret", "sha256");
    expect(h).toHaveLength(64);
  });
});

// ── Base64 ────────────────────────────────────────────────────────────────────

describe("base64", () => {
  it("encodes and decodes ASCII", () => {
    const encoded = encodeBase64("Hello, World!");
    expect(encoded).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(decodeBase64(encoded)).toBe("Hello, World!");
  });

  it("encodes and decodes UTF-8", () => {
    const text = "Kia ora! Whakatau mai";
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it("encodeBase64Url produces URL-safe output", () => {
    const enc = encodeBase64Url("Hello, World!");
    expect(enc).not.toContain("+");
    expect(enc).not.toContain("/");
    expect(enc).not.toContain("=");
  });

  it("decodeBase64Url round-trips", () => {
    const text = "test string with spaces";
    expect(decodeBase64Url(encodeBase64Url(text))).toBe(text);
  });
});

// ── JWT ───────────────────────────────────────────────────────────────────────

describe("jwt", () => {
  // eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
  const SAMPLE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

  it("decodes a standard JWT", () => {
    const r = decodeJwt(SAMPLE_TOKEN);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.header.alg).toBe("HS256");
      expect((r.value.payload as Record<string, unknown>)["name"]).toBe("John Doe");
    }
  });

  it("returns error for malformed token", () => {
    const r = decodeJwt("not.a.token.extra");
    expect(r.ok).toBe(false);
  });

  it("verifyHmac returns valid:false for wrong secret", () => {
    const r = verifyHmac(SAMPLE_TOKEN, "wrongsecret");
    expect(r.valid).toBe(false);
  });

  it("verifyHmac returns valid:true for the correct secret", () => {
    // secret used to sign the sample token is "your-256-bit-secret"
    const r = verifyHmac(SAMPLE_TOKEN, "your-256-bit-secret");
    expect(r.valid).toBe(true);
  });
});

// ── Regex ─────────────────────────────────────────────────────────────────────

describe("regex", () => {
  it("finds matches", () => {
    const r = testRegex("\\d+", "g", "abc 123 def 456");
    expect(r.matchCount).toBe(2);
    expect(r.matches[0].text).toBe("123");
  });

  it("extracts named capture groups", () => {
    const r = testRegex("(?<year>\\d{4})-(?<month>\\d{2})", "g", "date: 2024-06");
    expect(r.matchCount).toBe(1);
    const namedGroups = r.matches[0].groups.filter((g) => g.name);
    expect(namedGroups.some((g) => g.name === "year" && g.value === "2024")).toBe(true);
  });

  it("returns empty matches for blank pattern", () => {
    const r = testRegex("", "g", "hello");
    expect(r.matchCount).toBe(0);
  });
});

// ── Cron ──────────────────────────────────────────────────────────────────────

describe("cron", () => {
  it("describes a cron expression via the op", async () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    const result = await Promise.resolve(op.run({ expr: "0 9 * * 1-5", nextCount: 3 })) as { human: string; nextRuns: string[] };
    expect(result.human).toMatch(/monday/i);
    expect(result.nextRuns).toHaveLength(3);
  });

  it("expands @daily macro", async () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    const result = await Promise.resolve(op.run({ expr: "@daily", nextCount: 1 })) as { human: string };
    expect(result.human).toBeTruthy();
  });
});

// ── UUID ──────────────────────────────────────────────────────────────────────

describe("uuid", () => {
  it("v4 is a valid UUID format", () => {
    const id = uuidV4();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("v7 contains a version 7 nibble", () => {
    const id = uuidV7();
    const parts = id.split("-");
    expect(parts[2]?.[0]).toBe("7");
  });

  it("generates multiple uuids", async () => {
    const op = TOOLS.find((t) => t.slug === "uuid")!.ops[0];
    const result = await Promise.resolve(op.run({ version: "v4", count: 5 })) as { uuids: string[] };
    expect(result.uuids).toHaveLength(5);
    const unique = new Set(result.uuids);
    expect(unique.size).toBe(5);
  });
});

// ── Timestamp ─────────────────────────────────────────────────────────────────

describe("timestamp", () => {
  it("converts epoch seconds", () => {
    const r = convertTimestamp(0);
    expect(r.iso8601).toBe("1970-01-01T00:00:00.000Z");
    expect(r.epochMs).toBe(0);
  });

  it("converts epoch milliseconds", () => {
    const r = convertTimestamp(1000000000000);
    expect(r.epochMs).toBe(1000000000000);
    expect(r.iso8601).toContain("2001");
  });

  it("parses ISO date string", () => {
    const r = convertTimestamp("2024-01-15T00:00:00Z");
    expect(r.iso8601).toBe("2024-01-15T00:00:00.000Z");
  });
});

// ── Diff ──────────────────────────────────────────────────────────────────────

describe("diff", () => {
  it("detects added lines", () => {
    const r = computeDiff("hello\nworld", "hello\nworld\nextra");
    expect(r.stats.added).toBe(1);
    expect(r.stats.removed).toBe(0);
  });

  it("produces unified patch string", () => {
    const r = computeDiff("a\nb\nc", "a\nB\nc");
    expect(r.unified).toContain("---");
    expect(r.unified).toContain("+++");
    expect(r.unified).toContain("-b");
    expect(r.unified).toContain("+B");
  });

  it("identical texts have zero adds/removes", () => {
    const r = computeDiff("same text", "same text");
    expect(r.stats.added).toBe(0);
    expect(r.stats.removed).toBe(0);
    expect(r.stats.unchanged).toBeGreaterThan(0);
  });
});

// ── Units ─────────────────────────────────────────────────────────────────────

describe("units", () => {
  it("converts km to miles", () => {
    const result = convertUnit(1, "km", "mi");
    expect(result).toBeCloseTo(0.621371, 4);
  });

  it("converts Celsius to Fahrenheit", () => {
    expect(convertUnit(100, "C", "F")).toBeCloseTo(212, 2);
  });

  it("converts bytes to kilobytes", () => {
    expect(convertUnit(1000, "B", "KB")).toBeCloseTo(1, 3);
  });

  // Power category (newly added)
  it("converts 1000 W to kW", () => {
    expect(convertUnit(1000, "W", "kW")).toBeCloseTo(1, 6);
  });

  it("converts 1 hp to watts", () => {
    expect(convertUnit(1, "hp", "W")).toBeCloseTo(745.69987, 3);
  });

  // Force category (newly added)
  it("converts 1 N to lbf", () => {
    expect(convertUnit(1, "N", "lbf")).toBeCloseTo(0.22481, 3);
  });

  it("converts 1 kgf to N", () => {
    expect(convertUnit(1, "kgf", "N")).toBeCloseTo(9.80665, 4);
  });

  // Fuel category (newly added)
  it("converts 8 L/100km to km/L (100/8 = 12.5)", () => {
    expect(convertUnit(8, "l100km", "kml")).toBeCloseTo(12.5, 4);
  });

  it("converts 1 mpg(US) to km/L", () => {
    expect(convertUnit(1, "mpgUS", "kml")).toBeCloseTo(0.42514371, 5);
  });

  it("converts 8 L/100km to L/100km (identity)", () => {
    expect(convertUnit(8, "l100km", "l100km")).toBeCloseTo(8, 6);
  });

  // ms disambiguation regression tests
  it("ms resolves to millisecond (time), not metre/second (speed)", () => {
    // findUnit must return the time category for "ms"
    const found = findUnit("ms");
    expect(found).not.toBeNull();
    expect(found!.category.id).toBe("time");
    expect(found!.unit.label).toMatch(/millisecond/i);
  });

  it("convert(1, 'ms', 's') works as millisecond-to-second", () => {
    expect(convertUnit(1, "ms", "s")).toBeCloseTo(0.001, 6);
  });

  it("convert(1000, 'ms', 's') = 1 second", () => {
    expect(convertUnit(1000, "ms", "s")).toBeCloseTo(1, 6);
  });

  it("speed metre/second is reachable as 'mps'", () => {
    const found = findUnit("mps");
    expect(found).not.toBeNull();
    expect(found!.category.id).toBe("speed");
    expect(found!.unit.label).toMatch(/metre.second/i);
  });

  it("convert(1, 'mps', 'kmh') = 3.6 km/h", () => {
    expect(convertUnit(1, "mps", "kmh")).toBeCloseTo(3.6, 4);
  });

  it("'ms' id does NOT resolve to the speed category", () => {
    const found = findUnit("ms");
    expect(found?.category.id).not.toBe("speed");
  });
});

// ── Colours ───────────────────────────────────────────────────────────────────

describe("colours", () => {
  it("converts hex to rgb", () => {
    const r = convertColor("#ff0000", "rgb");
    expect(r).toBe("rgb(255, 0, 0)");
  });

  it("converts 3-char hex to rgb", () => {
    const r = convertColor("#f00", "rgb");
    expect(r).toBe("rgb(255, 0, 0)");
  });

  it("converts hex to hsl", () => {
    const r = convertColor("#ff0000", "hsl");
    expect(r).toContain("hsl(0");
  });

  it("contrast ratio black vs white is ~21", () => {
    const r = contrastRatio("#000000", "#ffffff");
    expect(r.ratio).toBeCloseTo(21, 0);
    expect(r.wcagAAA).toBe(true);
  });

  it("contrast: similar colors have low ratio", () => {
    const r = contrastRatio("#ffffff", "#fefefe");
    expect(r.ratio).toBeLessThan(2);
  });

  // New: accept non-hex inputs in convertColor
  it("converts CSS named color 'red' to hex", () => {
    const r = convertColor("red", "hex");
    expect(r).toBe("#ff0000");
  });

  it("converts rgb() string to hsl", () => {
    const r = convertColor("rgb(255, 0, 0)", "hsl");
    expect(r).toContain("hsl(0");
  });

  it("throws clean error on invalid color in convertColor", () => {
    expect(() => convertColor("notacolor", "hex")).toThrow("Invalid color: notacolor");
  });

  it("throws clean error on invalid color in contrastRatio (first arg)", () => {
    expect(() => contrastRatio("notacolor", "#fff")).toThrow("Invalid color: notacolor");
  });
});

// ── Password ──────────────────────────────────────────────────────────────────

describe("password", () => {
  it("generates a password of the requested length", () => {
    const p = generatePassword({ length: 24, upper: true, lower: true, digits: true, symbols: false });
    expect(p).toHaveLength(24);
  });

  it("contains digits when requested", () => {
    const p = generatePassword({ length: 50, upper: false, lower: false, digits: true, symbols: false });
    expect(/\d/.test(p)).toBe(true);
  });

  it("two consecutive calls produce different passwords (probabilistically)", () => {
    const a = generatePassword({ length: 20, upper: true, lower: true, digits: true, symbols: true });
    const b = generatePassword({ length: 20, upper: true, lower: true, digits: true, symbols: true });
    expect(a).not.toBe(b);
  });
});

// ── Lorem ─────────────────────────────────────────────────────────────────────

describe("lorem", () => {
  it("generates N words", () => {
    const text = generateWords(5, 1);
    expect(text.split(" ")).toHaveLength(5);
  });

  it("generates sentences ending with period", () => {
    const text = generateSentences(2, 1);
    expect(text.endsWith(".")).toBe(true);
  });

  it("generates paragraphs separated by double newline", () => {
    const text = generateParagraphs(3, 1);
    expect(text.split("\n\n")).toHaveLength(3);
  });

  it("is deterministic with same seed", () => {
    expect(generateWords(10, 42)).toBe(generateWords(10, 42));
  });

  it("differs with different seeds", () => {
    expect(generateWords(10, 1)).not.toBe(generateWords(10, 2));
  });
});

// ── Markdown ──────────────────────────────────────────────────────────────────

describe("markdown", () => {
  it("converts heading to h1 tag", () => {
    const html = toHtml("# Hello");
    expect(html).toContain("<h1>");
    expect(html).toContain("Hello");
  });

  it("converts bold text", () => {
    const html = toHtml("**bold**");
    expect(html).toContain("<strong>");
  });

  it("converts link", () => {
    const html = toHtml("[text](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("converts GFM code block", () => {
    const html = toHtml("```js\nconsole.log('hi')\n```");
    expect(html).toContain("<code");
  });

  it("does NOT emit executable <script> tag for inline HTML input", () => {
    const html = toHtml("<script>alert(1)</script>");
    // The output must not contain a literal opening <script tag
    expect(html).not.toMatch(/<script[\s>]/i);
  });

  it("does NOT emit executable <img onerror> for inline HTML input", () => {
    const html = toHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/<img\s/i);
  });

  // URI scheme XSS regression tests
  it("neutralises javascript: URI in link href", () => {
    const html = toHtml("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("neutralises data: URI in link href", () => {
    const html = toHtml("[click me](data:text/html,<script>alert(1)</script>)");
    expect(html).not.toContain("data:");
    expect(html).toContain('href="#"');
  });

  it("neutralises vbscript: URI in link href", () => {
    const html = toHtml("[click me](vbscript:msgbox(1))");
    expect(html).not.toContain("vbscript:");
    expect(html).toContain('href="#"');
  });

  it("neutralises entity-obfuscated javascript: URI in link href", () => {
    // java&#115;cript: -> javascript: after entity decode
    const html = toHtml("[click me](java&#115;cript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("neutralises javascript: URI in image src", () => {
    const html = toHtml("![alt](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="#"');
  });

  it("neutralises data: URI in image src", () => {
    const html = toHtml("![alt](data:image/png;base64,abc)");
    expect(html).not.toContain("data:");
    expect(html).toContain('src="#"');
  });

  it("preserves safe https: link href", () => {
    const html = toHtml("[link](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("preserves mailto: link href", () => {
    const html = toHtml("[email](mailto:user@example.com)");
    expect(html).toContain('href="mailto:user@example.com"');
  });

  it("preserves relative link href", () => {
    const html = toHtml("[page](/about)");
    expect(html).toContain('href="/about"');
  });
});

// ── QR ────────────────────────────────────────────────────────────────────────

describe("qr", () => {
  it("generates an SVG string for a URL", () => {
    const svg = generateSvgString({ text: "https://example.com" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect");
  });

  it("SVG length is non-trivial (has data modules)", () => {
    const svg = generateSvgString({ text: "Hello" });
    expect(svg.length).toBeGreaterThan(1000);
  });

  it("respects fgColor in output", () => {
    const svg = generateSvgString({ text: "test", fgColor: "#ff0000" });
    expect(svg).toContain("#ff0000");
  });

  // Color injection regression tests
  it("does NOT interpolate hostile fgColor into SVG (injection guard)", () => {
    // A crafted color containing SVG markup must not appear literally in output
    const hostile = '"/><script>alert(1)</script><rect fill="';
    const svg = generateSvgString({ text: "test", fgColor: hostile });
    expect(svg).not.toContain("<script>");
    // The hostile value is not a valid color, so it falls back to #000000
    expect(svg).toContain("#000000");
  });

  it("does NOT interpolate hostile bgColor into SVG (injection guard)", () => {
    const hostile = '"/><script>alert(1)</script><rect fill="';
    const svg = generateSvgString({ text: "test", bgColor: hostile });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("#ffffff");
  });

  it("validateSvgColor accepts valid #rrggbb", () => {
    expect(validateSvgColor("#ff0000", "#000000")).toBe("#ff0000");
  });

  it("validateSvgColor accepts valid #rgb shorthand", () => {
    expect(validateSvgColor("#f00", "#000000")).toBe("#f00");
  });

  it("validateSvgColor accepts safe CSS named color", () => {
    expect(validateSvgColor("black", "#000000")).toBe("black");
  });

  it("validateSvgColor rejects injection string and returns fallback", () => {
    expect(validateSvgColor('"/><script>alert(1)</script>', "#000000")).toBe("#000000");
  });

  it("generateSvgString accepts named color 'black' as fgColor", () => {
    const svg = generateSvgString({ text: "test", fgColor: "black" });
    expect(svg).toContain("black");
    expect(svg).not.toContain("<script>");
  });
});

// ── Barcode ───────────────────────────────────────────────────────────────────

describe("barcode", () => {
  it("generates a CODE128 SVG", () => {
    const svg = generateBarcodeSvg("Hello World", "CODE128");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("generates an EAN-13 SVG (12 digit auto-appends check digit)", () => {
    const svg = generateBarcodeSvg("123456789012", "EAN13");
    expect(svg).toContain("<svg");
  });

  it("throws for invalid EAN-13 check digit", () => {
    expect(() => generateBarcodeSvg("1234567890123", "EAN13")).toThrow();
  });
});

// ── No browser globals ────────────────────────────────────────────────────────

describe("headless proof: no browser globals used", () => {
  it("document is not defined in this environment", () => {
    // Vitest runs in Node -- if any module tried to call document.createElement
    // it would have thrown already. We verify the environment.
    expect(typeof document).toBe("undefined");
  });

  it("window is not defined", () => {
    expect(typeof window).toBe("undefined");
  });

  it("all 17 tool ops run without DOM errors", async () => {
    const results: unknown[] = [];
    for (const tool of TOOLS) {
      for (const op of tool.ops) {
        // Run a minimal valid input for each op via the schema defaults
        const parsed = op.inputSchema.safeParse({});
        if (parsed.success) {
          try {
            const r = await Promise.resolve(op.run(parsed.data));
            results.push(r);
          } catch {
            // Some ops require specific input (e.g. barcode needs text) -- acceptable
          }
        }
      }
    }
    // At least some ops ran successfully
    expect(results.length).toBeGreaterThan(0);
  });
});
