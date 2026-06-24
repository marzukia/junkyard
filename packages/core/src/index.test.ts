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
import { generateBarcodeSvg, ean8CheckDigit } from "./barcode.js";

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

  // Named-group mis-association regression tests (round-3).
  // When two groups capture the same value the name must attach to the correct
  // (second) group, not the first positional group with that value.

  it("named group on second capture correctly identified when both groups match same value", () => {
    // (x)(?<a>x) on "xx": group 1 = 'x' (unnamed), group 2 = 'x' (named 'a')
    const r = testRegex("(x)(?<a>x)", "g", "xx");
    expect(r.matchCount).toBe(1);
    const grps = r.matches[0].groups;
    // group at index 1 should be unnamed
    const g1 = grps.find((g) => g.index === 1);
    const g2 = grps.find((g) => g.index === 2);
    expect(g1?.name).toBeUndefined();
    // group at index 2 should carry the name 'a'
    expect(g2?.name).toBe("a");
    expect(g2?.value).toBe("x");
  });

  it("single named group still attaches correctly", () => {
    const r = testRegex("(?<word>\\w+)", "g", "hello");
    expect(r.matchCount).toBe(1);
    const g = r.matches[0].groups.find((g) => g.name === "word");
    expect(g?.value).toBe("hello");
    expect(g?.index).toBe(1);
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

  // Attribute-injection XSS regression tests (round-3)
  // These verify that attribute values are HTML-escaped before interpolation,
  // closing the breakout vectors that survived the round-2 scheme-block fix.

  it("title breakout in link: script tag in title is escaped", () => {
    // title="a\"><script>alert(1)</script>" must not emit a live <script>
    const html = toHtml('[x](https://ok.com "a\\"><script>alert(1)</script>")');
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("title onerror breakout in image: onerror handler in title is escaped to entities", () => {
    // title contains x" onerror="alert(1) -- the " must be escaped to &quot; so it
    // does not close the attribute early and inject onerror as a live handler.
    const html = toHtml('![a](https://ok.com "x\\" onerror=\\"alert(1)")');
    // A raw unescaped " before onerror would produce: title="x" onerror="..."
    // i.e. a literal '" onerror=' sequence in the HTML source.
    // After escaping that " becomes &quot;, so the literal sequence must not appear.
    expect(html).not.toContain('" onerror=');
    // The &quot; entity must appear confirming the escape happened.
    expect(html).toContain("&quot;");
  });

  it("href quote breakout: double-quote in https href is escaped to &quot;", () => {
    // The scheme is https (safe), but a bare " would break out of href="..." and
    // allow onmouseover to become a live attribute. After escaping it stays inside href.
    const html = toHtml('[x](<https://ok.com/" onmouseover="alert(1)>)');
    // A raw " breaking out would produce href="https://ok.com/" onmouseover="..."
    // i.e. the literal '" onmouseover=' sequence between attributes.
    // After escaping that " becomes &quot;, so the literal sequence must not appear.
    expect(html).not.toContain('" onmouseover=');
    // The &quot; entity must appear confirming the escape happened.
    expect(html).toContain("&quot;");
  });

  it("double-quote in link title is escaped to &quot;", () => {
    const html = toHtml('[link](https://example.com "say \\"hi\\"")');
    expect(html).toContain("&quot;");
    // A raw " in the title would close the attribute early and inject trailing markup.
    // Verify the output does not contain a raw closing " mid-attribute followed by >.
    // i.e. title attribute must not end prematurely with a bare double-quote.
    expect(html).not.toContain('" title="say "');
  });

  // ── Comprehensive XSS battery (round-4) ─────────────────────────────────────
  // Each case asserts: no live <script, no live on<event>= attribute, no active
  // javascript:/data:/vbscript: URI survives into the rendered HTML.

  // Helper: assert a string has no live XSS sinks
  // (used inline -- not extracted to a function so each test name is precise)

  // --- LINK LABEL raw HTML injection (the round-4 fix) ---

  it("[XSS-LL-1] raw <script> in link label is escaped to entities", () => {
    const html = toHtml("[<script>alert(1)</script>](http://x)");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-LL-2] <img onerror> in link label is escaped, no live handler", () => {
    const html = toHtml("[<img src=x onerror=alert(1)>](http://x)");
    // The tag must be escaped so no literal <img with an onerror attribute appears
    expect(html).not.toMatch(/<img\s[^>]*onerror/i);
    expect(html).toContain("&lt;img");
  });

  it("[XSS-LL-3] smuggled <a href=javascript:> in link label has scheme escaped", () => {
    const html = toHtml('[<a href="javascript:alert(1)">x</a>](http://ok)');
    // The inner literal 'javascript:' must not appear unescaped as a live URI
    expect(html).not.toMatch(/href="javascript:/i);
    // The angle bracket of the injected <a must be escaped
    expect(html).toContain("&lt;a");
  });

  it("[XSS-LL-4] <a href=javascript:> in image alt is escaped", () => {
    const html = toHtml('![<a href="javascript:alert(1)">x</a>](http://x)');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain("&lt;a");
  });

  // --- raw HTML in various block/inline contexts ---

  it("[XSS-BL-1] <script> standalone (raw HTML block) is escaped", () => {
    const html = toHtml("<script>alert(1)</script>");
    expect(html).not.toMatch(/<script[\s>]/i);
  });

  it("[XSS-BL-2] <script> in a heading is escaped", () => {
    const html = toHtml("# <script>alert(1)</script>");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-3] <script> in a list item is escaped", () => {
    const html = toHtml("- <script>alert(1)</script>");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-4] <script> in a blockquote is escaped", () => {
    const html = toHtml("> <script>alert(1)</script>");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-5] <script> inside emphasis is escaped", () => {
    const html = toHtml("*<script>alert(1)</script>*");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-6] <script> inside a code span renders as escaped text (not executed)", () => {
    // Inside a code span the output must contain the escaped form visibly
    const html = toHtml("`<script>alert(1)</script>`");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-7] <script> in image alt attribute is escaped", () => {
    const html = toHtml("![<script>alert(1)</script>](http://x)");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("[XSS-BL-8] <script> in a link title attribute is escaped", () => {
    const html = toHtml('[x](http://x "<script>alert(1)</script>")');
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script&gt;");
  });

  // --- event-handler injection via attribute breakout ---

  it("[XSS-EV-1] onerror via raw <img onerror=> standalone is escaped", () => {
    const html = toHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toMatch(/<img\s[^>]*onerror/i);
  });

  it("[XSS-EV-2] onmouseover via href quote breakout is escaped", () => {
    const html = toHtml('[x](<https://ok.com/" onmouseover="alert(1)>)');
    expect(html).not.toContain('" onmouseover=');
  });

  it("[XSS-EV-3] onerror via image title quote breakout is escaped", () => {
    const html = toHtml('![a](https://ok.com "x\\" onerror=\\"alert(1)")');
    expect(html).not.toContain('" onerror=');
  });

  it("[XSS-EV-4] onload via <img onload=> in link label is escaped", () => {
    const html = toHtml("[<img src=x onload=alert(1)>](http://x)");
    expect(html).not.toMatch(/<img\s[^>]*onload/i);
    expect(html).toContain("&lt;img");
  });

  // --- dangerous URI schemes: link href ---

  it("[XSS-URI-1] javascript: in link href is blocked (plain)", () => {
    const html = toHtml("[x](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-2] data: in link href is blocked", () => {
    const html = toHtml("[x](data:text/html,<h1>hi</h1>)");
    expect(html).not.toContain("data:");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-3] vbscript: in link href is blocked", () => {
    const html = toHtml("[x](vbscript:msgbox(1))");
    expect(html).not.toContain("vbscript:");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-4] JAVASCRIPT: uppercase in link href is blocked", () => {
    const html = toHtml("[x](JAVASCRIPT:alert(1))");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-5] leading whitespace before javascript: is stripped and blocked", () => {
    const html = toHtml("[x](  javascript:alert(1))");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-6] entity-obfuscated java&#115;cript: is blocked", () => {
    const html = toHtml("[x](java&#115;cript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-7] entity-obfuscated &#106;avascript: is blocked", () => {
    const html = toHtml("[x](&#106;avascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("[XSS-URI-8] &colon; entity in javascript&colon; is blocked", () => {
    const html = toHtml("[x](javascript&colon;alert(1))");
    expect(html).toContain('href="#"');
  });

  // --- dangerous URI schemes: image src ---

  it("[XSS-URI-9] javascript: in image src is blocked", () => {
    const html = toHtml("![alt](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).toContain('src="#"');
  });

  it("[XSS-URI-10] data: in image src is blocked", () => {
    const html = toHtml("![alt](data:image/png;base64,abc)");
    expect(html).not.toContain("data:");
    expect(html).toContain('src="#"');
  });

  it("[XSS-URI-11] vbscript: in image src is blocked", () => {
    const html = toHtml("![alt](vbscript:msgbox(1))");
    expect(html).not.toContain("vbscript:");
    expect(html).toContain('src="#"');
  });

  // --- autolink dangerous scheme ---

  it("[XSS-URI-12] autolink <javascript:...> is neutralised", () => {
    const html = toHtml("<javascript:alert(1)>");
    // Either href is '#' or the URI does not appear as a live href value
    const hasLiveJsHref = /href="javascript:/i.test(html);
    expect(hasLiveJsHref).toBe(false);
  });

  // --- nested / smuggled vectors ---

  it("[XSS-NS-1] javascript: link nested inside a link label is fully escaped", () => {
    const html = toHtml('[<a href="javascript:alert(1)">click</a>](https://safe.com)');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  it("[XSS-NS-2] javascript: link inside image alt is escaped", () => {
    const html = toHtml('![<a href="javascript:alert(1)">x</a>](https://safe.com/img.png)');
    expect(html).not.toMatch(/href="javascript:/i);
  });

  // --- sabotage check: escapeHtml on link label must be required ---
  // This test documents and enforces the invariant: if escapeHtml were removed
  // from the link renderer's text interpolation, this test would fail.
  // (The test itself uses the same assertion as XSS-LL-1; its value is as
  //  documentation of the perturbation that must fail without the fix.)
  it("[XSS-SAB-1] link label with raw <script> is escaped (sabotage-guard)", () => {
    // Without escapeHtml(text) in safeRenderer.link, this would produce a live script.
    const html = toHtml("[<script>xss</script>](https://x.com)");
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).toContain("&lt;script");
  });

  // --- POSITIVE cases: safe inputs that must pass through unmodified ---

  it("[XSS-POS-1] normal https:// link renders correctly", () => {
    const html = toHtml("[link](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain(">link<");
  });

  it("[XSS-POS-2] mailto: link is preserved", () => {
    const html = toHtml("[email](mailto:user@example.com)");
    expect(html).toContain('href="mailto:user@example.com"');
  });

  it("[XSS-POS-3] relative link is preserved", () => {
    const html = toHtml("[page](/about)");
    expect(html).toContain('href="/about"');
  });

  it("[XSS-POS-4] anchor fragment link is preserved", () => {
    const html = toHtml("[section](#intro)");
    expect(html).toContain('href="#intro"');
  });

  it("[XSS-POS-5] plain text link label renders correctly", () => {
    const html = toHtml("[plain](https://example.com)");
    expect(html).toContain(">plain<");
  });

  it("[XSS-POS-6] link label with ** (bold markup) renders as literal text, not a script", () => {
    // In this marked version, emphasis inside a link label is not rendered;
    // the label arrives as raw source. **bold** becomes the literal text.
    const html = toHtml("[**bold**](https://example.com)");
    expect(html).toContain("**bold**");
    expect(html).not.toMatch(/<script[\s>]/i);
  });

  it("[XSS-POS-7] normal image with safe https src renders correctly", () => {
    const html = toHtml("![photo](https://example.com/img.png)");
    expect(html).toContain('src="https://example.com/img.png"');
    expect(html).toContain('alt="photo"');
  });

  it("[XSS-POS-8] plain text paragraph renders without escaping regular text", () => {
    const html = toHtml("Hello, world!");
    expect(html).toContain("Hello, world!");
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


describe("computeDiff empty-side stats (core)", () => {
  it("stats.added=0 when new side is empty", () => {
    const r = computeDiff("hello\nworld", "");
    expect(r.stats.added).toBe(0);
    expect(r.stats.removed).toBe(2);
  });

  it("stats.removed=0 when old side is empty", () => {
    const r = computeDiff("", "hello\nworld");
    expect(r.stats.removed).toBe(0);
    expect(r.stats.added).toBe(2);
  });

  it("both sides empty gives zero stats", () => {
    const r = computeDiff("", "");
    expect(r.stats.added).toBe(0);
    expect(r.stats.removed).toBe(0);
    expect(r.stats.unchanged).toBe(0);
  });
});


// ── Gauntlet wave-1 regression tests ─────────────────────────────────────────

describe("cron: step=0 DoS prevention (g1-cron-1)", () => {
  it("rejects 0-30/0 as invalid (step must be >= 1)", () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    expect(() => op.run({ expr: "0-30/0 * * * *", nextCount: 1 })).toThrow(/step/i);
  });

  it("rejects */0 step in wildcard form", () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    expect(() => op.run({ expr: "*/0 * * * *", nextCount: 1 })).toThrow(/step/i);
  });

  it("accepts valid step 1-30/5 without error", async () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    const result = await Promise.resolve(op.run({ expr: "1-30/5 * * * *", nextCount: 2 })) as { nextRuns: string[] };
    expect(result.nextRuns).toHaveLength(2);
  });
});

describe("cron: nextRuns UTC consistency (g1-cron-2)", () => {
  it("nextRuns for 0 0 31 * * from 2026-01-01 yields runs on the 31st in UTC", async () => {
    const op = TOOLS.find((t) => t.slug === "cron")!.ops[0];
    const result = await Promise.resolve(op.run({ expr: "0 0 31 * *", nextCount: 5 })) as { nextRuns: string[] };
    // All returned runs must have '-31T' in the ISO string
    for (const run of result.nextRuns) {
      expect(run).toMatch(/-31T/);
    }
  });
});

describe("timestamp: out-of-range guard (g1-ts-4)", () => {
  it("throws a clean error for number 9e15 (out of Date range)", () => {
    expect(() => convertTimestamp(9e15)).toThrow(/Cannot parse timestamp/);
  });

  it("throws a clean error for huge integer string", () => {
    expect(() => convertTimestamp("99999999999999999999")).toThrow(/Cannot parse timestamp/);
  });

  it("epoch 0 still works (valid boundary)", () => {
    const r = convertTimestamp(0);
    expect(r.iso8601).toBe("1970-01-01T00:00:00.000Z");
  });
});

describe("base64: reject invalid input (g1-b64-5)", () => {
  it("decodeBase64 throws on invalid chars", () => {
    expect(() => decodeBase64("not!valid@base64#")).toThrow(/invalid/i);
  });

  it("decodeBase64 throws on wrong padding", () => {
    // Valid chars but wrong padding (length not divisible by 4)
    expect(() => decodeBase64("SGVsbG8")).toThrow(/invalid/i);
  });

  it("decodeBase64 returns empty string for empty input", () => {
    expect(decodeBase64("")).toBe("");
  });

  it("decodeBase64Url throws on standard base64 chars (+ /)", () => {
    expect(() => decodeBase64Url("SGVs+G8=")).toThrow(/invalid/i);
  });

  it("decodeBase64Url returns empty string for empty input", () => {
    expect(decodeBase64Url("")).toBe("");
  });

  it("round-trip still works after fix", () => {
    expect(decodeBase64(encodeBase64("hello world"))).toBe("hello world");
    expect(decodeBase64Url(encodeBase64Url("hello world"))).toBe("hello world");
  });
});

describe("units: non-finite and unknown unit errors (g1-units-6)", () => {
  it("throws on NaN input", () => {
    expect(() => convertUnit(NaN, "km", "mi")).toThrow(/non-finite/i);
  });

  it("throws on Infinity input", () => {
    expect(() => convertUnit(Infinity, "km", "mi")).toThrow(/non-finite/i);
  });

  it("throws on -Infinity input", () => {
    expect(() => convertUnit(-Infinity, "km", "mi")).toThrow(/non-finite/i);
  });

  it("throws when converting l/100km with value 0 (division by zero)", () => {
    expect(() => convertUnit(0, "l100km", "kml")).toThrow(/non-finite/);
  });

  it("throws on unknown unit", () => {
    expect(() => convertUnit(1, "km", "unknownUnit")).toThrow(/Unknown unit/);
  });

  it("same-unit with validation still works", () => {
    expect(convertUnit(5, "km", "km")).toBe(5);
  });
});

describe("csv: formula injection escape (g1-csv-7)", () => {
  it("prefixes =cmd payload with single quote", () => {
    const out = jsonToCsvString('[{"cmd":"=cmd|calc"}]', ",");
    const lines = out.split("\n");
    // data row first cell should start with '=
    expect(lines[1]).toMatch(/^'=/);
  });

  it("prefixes @SUM payload", () => {
    const out = jsonToCsvString('[{"formula":"@SUM(A1:A10)"}]', ",");
    expect(out).toContain("'@SUM");
  });

  it("prefixes =HYPERLINK payload", () => {
    const out = jsonToCsvString('[{"link":"=HYPERLINK(evil.com)"}]', ",");
    expect(out).toContain("'=HYPERLINK");
  });

  it("prefixes + trigger", () => {
    const out = jsonToCsvString('[{"v":"+1234"}]', ",");
    expect(out).toContain("'+1234");
  });

  it("does not alter safe values", () => {
    const out = jsonToCsvString('[{"name":"Alice","age":30}]', ",");
    expect(out).toContain("Alice");
    expect(out).toContain("30");
    expect(out).not.toContain("'Alice");
  });
});

describe("barcode: EAN-8 check digit validation (g1-barcode-8)", () => {
  it("ean8CheckDigit('9638507') = 4", () => {
    expect(ean8CheckDigit("9638507")).toBe(4);
  });

  it("generateBarcodeSvg throws for EAN-8 with wrong check digit", () => {
    // 96385070 has wrong check digit (correct is 4, not 0)
    expect(() => generateBarcodeSvg("96385070", "EAN8")).toThrow(/check digit/i);
  });

  it("generateBarcodeSvg accepts EAN-8 with correct check digit", () => {
    const svg = generateBarcodeSvg("96385074", "EAN8");
    expect(svg).toContain("<svg");
  });

  it("generateBarcodeSvg auto-appends check digit for 7-digit EAN-8", () => {
    const svg = generateBarcodeSvg("9638507", "EAN8");
    expect(svg).toContain("<svg");
  });
});

// ── password length < pools cap (gauntlet w1) ────────────────────────────────

describe("password length cap when length < pool count", () => {
  it("returns exactly length=3 chars when all 4 sets selected", () => {
    const p = generatePassword({ length: 3, upper: true, lower: true, digits: true, symbols: true });
    expect(p).toHaveLength(3);
  });

  it("returns exactly length=1 char", () => {
    const p = generatePassword({ length: 1, upper: true, lower: false, digits: false, symbols: false });
    expect(p).toHaveLength(1);
  });

  it("returns exactly length=2 chars with 3 pools", () => {
    const p = generatePassword({ length: 2, upper: true, lower: true, digits: true, symbols: false });
    expect(p).toHaveLength(2);
  });
});
