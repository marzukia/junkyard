# @junkyard/core

Pure logic library for the 17 junkyard tools. No browser APIs, no framework dependencies, no side effects. This package is the single source of truth for tool behaviour shared by the web apps and the MCP server.

## Why it exists

The junkyard monorepo has multiple consumers of the same tool logic: a React web UI and a stdio MCP server. Extracting the logic here means neither consumer owns it, tests run without a DOM, and adding a new consumer (CLI, HTTP API, etc.) requires no duplication.

## What it is NOT

`@junkyard/core` is not in the web-deploy path. It is a build-time dependency. It has no HTTP server, no CLI entrypoint, and no runtime process of its own.

## Public API

Every tool module exports:
- Typed functions (the callable pure logic)
- A `ToolDef` constant (the registry entry used by the MCP server and any future adapter)
- TypeScript types for inputs and outputs

### json

```ts
parseJson(raw: string): JsonParseOutcome          // parse with line/col error location
formatJson(raw: string, indent: IndentOption): string  // pretty-print (indent: 2 | 4 | "tab")
minifyJson(raw: string): string                    // strip whitespace
validateJson(raw: string): { valid: boolean; error?: string }
```

### csv

```ts
detectDelimiter(text: string): Delimiter          // auto-detect , \t ; |
parseCsv(text: string, opts: CsvParseOptions): { ok: true; value: ParsedCsv } | { ok: false; error: string }
csvToJsonString(csvText: string, delimiter?: Delimiter): string
jsonToCsvString(jsonText: string, delimiter?: Delimiter): string
```

### hash

```ts
hash(text: string, algo: HashAlgo): string        // algo: "md5" | "sha1" | "sha256" | "sha512"
hmac(text: string, secret: string, algo?: HashAlgo): string
```

### base64

```ts
encodeBase64(text: string): string
decodeBase64(encoded: string): string
encodeBase64Url(text: string): string             // RFC 4648 URL-safe alphabet
decodeBase64Url(encoded: string): string
```

### jwt

```ts
decodeJwt(raw: string): { ok: true; value: DecodedJwt } | { ok: false; error: string }
verifyHmac(token: string, secret: string): { valid: boolean; error?: string }
```

`DecodedJwt` contains typed `header`, `payload`, and `signature` fields.

### regex

```ts
testRegex(pattern: string, flags: string, text: string): RegexTestResult
// RegexTestResult: { valid, matches: MatchSpan[], error? }
```

### cron

No standalone exported functions. Logic is self-contained inside `cronTool`. The `describe` op parses an expression (including macros such as `@daily`), returns a human-readable description, and computes the next N scheduled run times.

### uuid

```ts
uuidV4(): string
uuidV7(): string
generateUuids(version: UuidVersion, count: number): string[]  // version: "v4" | "v7"
```

### timestamp

```ts
convertTimestamp(input: string | number, nowMs?: number): ConversionResult
nowTimestamp(): ConversionResult
// ConversionResult contains unix, iso, local, and relative fields
```

### diff

```ts
computeDiff(oldText: string, newText: string): DiffResult
// DiffResult: { lines: SideBySideLine[], stats: { added, removed, unchanged } }
```

Uses the `diff` package internally; returns a structured side-by-side representation, not a raw unified-diff string.

### units

```ts
CATEGORIES: Category[]                             // all supported unit categories
findUnit(unitId: string): { category: Category; unit: UnitDef } | null
convert(value: number, fromId: string, toId: string, categoryId?: CategoryId): number
```

Supported categories: length, mass, temperature, area, volume, speed, data, time, pressure, energy, angle, power, force, fuel.

### colours

```ts
normalizeHex(raw: string): string | null
hexToRgb(hex: string): RgbColor | null
rgbToHex(r: number, g: number, b: number): string
hexToHsl(hex: string): HslColor | null
contrastRatio(color1: string, color2: string): { ratio: number; wcagAA: boolean; wcagAAA: boolean }
generateGradient(start: string, end: string, steps: number, space?: "lab" | "rgb" | "hsl"): string[]
convertColor(input: string, to: ConvertTarget): string   // to: "hex" | "rgb" | "hsl"
```

### password

```ts
generatePassword(opts: PasswordOptions): string
passwordEntropy(opts: PasswordOptions): number   // bits of entropy
// PasswordOptions: { length, upper, lower, digits, symbols }
```

### lorem

```ts
generateWords(count: number, seed?: number): string
generateSentences(count: number, seed?: number): string
generateParagraphs(count: number, seed?: number): string
makeRng(seed: number): () => number   // seeded PRNG (deterministic output)
```

### markdown

```ts
toHtml(md: string): string
```

Renders via `marked` with a custom safe renderer that escapes attribute values and sanitises link/image href schemes. See the XSS test battery below.

### qr

```ts
generateSvgString(opts: QrOptions): string
validateSvgColor(color: string, fallback: string): string
// QrOptions: { data, errorCorrectionLevel, size, foreground, background }
// errorCorrectionLevel: "L" | "M" | "Q" | "H"
```

Returns an SVG string, not a data URL.

### barcode

```ts
generateBarcodeSvg(value: string, format?: BarcodeFormat): string
// BarcodeFormat: "CODE128" | "EAN13" | "UPC" | "EAN8" | "CODE39" | "CODE93" | "ITF"
ean13CheckDigit(digits: string): number
upcaCheckDigit(digits: string): number
ean8CheckDigit(digits: string): number
```

Returns an SVG string.

## Registry

All 17 tools are collected into a single array:

```ts
import { TOOLS } from "@junkyard/core";
// TOOLS: ToolDef[]
// Each ToolDef: { slug: string; name: string; ops: ToolOp[] }
// Each ToolOp:  { name, description, inputSchema (Zod), run }
```

This is what the MCP server iterates to register tools. Adapters only need to import `TOOLS`.

## Tests

148 test cases in `src/index.test.ts` using Vitest, including a 58-test markdown section with a 39-test XSS battery covering script injection, `javascript:` URIs, attribute injection, and HTML block passthrough.

Run:

```bash
cd packages/core
npm install
npx vitest run
```

Or from the monorepo root if Vitest is available at workspace level:

```bash
npx vitest run packages/core/src/index.test.ts
```

## Dependencies

| Package | Purpose |
|---|---|
| `culori` | Colour space conversion (Lab interpolation for gradients) |
| `diff` | Line/word diff computation |
| `jsbarcode` | Barcode SVG generation |
| `marked` | Markdown-to-HTML rendering |
| `qrcode` | QR code SVG generation |
| `zod` | Input schema definition and validation for each op |
