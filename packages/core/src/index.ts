export type { ToolOp, ToolDef } from "./types.js";

// Each module is imported once. The export block below re-exports the full
// public surface. The TOOLS array is built from the same local bindings —
// no symbol is imported from the same source twice.
import { type IndentOption, type ParseError, type JsonParseOutcome, parseJson, formatJson, minifyJson, validateJson, jsonTool } from "./json.js";
import { type Delimiter, type CsvParseOptions, type ParsedCsv, detectDelimiter, parseCsv, csvToJsonString, jsonToCsvString, csvTool } from "./csv.js";
import { type HashAlgo, hash, hmac, hashTool } from "./hash.js";
import { encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url, base64Tool } from "./base64.js";
import { type JwtHeader, type JwtPayload, type DecodedJwt, decodeJwt, verifyHmac, jwtTool } from "./jwt.js";
import { type MatchSpan, type RegexTestResult, testRegex, regexTool } from "./regex.js";
import { cronTool } from "./cron.js";
import { type UuidVersion, uuidV4, uuidV7, generateUuids, uuidTool } from "./uuid.js";
import { type ConversionResult, convertTimestamp, nowTimestamp, timestampTool } from "./timestamp.js";
import { type ChangeKind, type WordChange, type SideBySideLine, type DiffResult, computeDiff, diffTool } from "./diff.js";
import { type CategoryId, type UnitDef, type Category, CATEGORIES, findUnit, convert, unitsTool } from "./units.js";
import { normalizeHex, type RgbColor, type HslColor, hexToRgb, rgbToHex, hexToHsl, contrastRatio, generateGradient, type ConvertTarget, convertColor, coloursTool } from "./colours.js";
import { type PasswordOptions, generatePassword, passwordEntropy, passwordTool } from "./password.js";
import { makeRng, generateWords, generateSentences, generateParagraphs, loremTool } from "./lorem.js";
import { toHtml, markdownTool } from "./markdown.js";
import { type ErrorCorrectionLevel, validateSvgColor, type QrOptions, generateSvgString, qrTool } from "./qr.js";
import { type BarcodeFormat, ean13CheckDigit, upcaCheckDigit, ean8CheckDigit, generateBarcodeSvg, barcodeTool } from "./barcode.js";
import { BRAND, CATEGORY_COLORS, type BrandColor } from "./brand.js";

import type { ToolDef } from "./types.js";

export {
  // json
  type IndentOption, type ParseError, type JsonParseOutcome, parseJson, formatJson, minifyJson, validateJson, jsonTool,
  // csv
  type Delimiter, type CsvParseOptions, type ParsedCsv, detectDelimiter, parseCsv, csvToJsonString, jsonToCsvString, csvTool,
  // hash
  type HashAlgo, hash, hmac, hashTool,
  // base64
  encodeBase64, decodeBase64, encodeBase64Url, decodeBase64Url, base64Tool,
  // jwt
  type JwtHeader, type JwtPayload, type DecodedJwt, decodeJwt, verifyHmac, jwtTool,
  // regex
  type MatchSpan, type RegexTestResult, testRegex, regexTool,
  // cron
  cronTool,
  // uuid
  type UuidVersion, uuidV4, uuidV7, generateUuids, uuidTool,
  // timestamp
  type ConversionResult, convertTimestamp, nowTimestamp, timestampTool,
  // diff
  type ChangeKind, type WordChange, type SideBySideLine, type DiffResult, computeDiff, diffTool,
  // units
  type CategoryId, type UnitDef, type Category, CATEGORIES, findUnit, convert, unitsTool,
  // colours
  normalizeHex, type RgbColor, type HslColor, hexToRgb, rgbToHex, hexToHsl, contrastRatio, generateGradient, type ConvertTarget, convertColor, coloursTool,
  // password
  type PasswordOptions, generatePassword, passwordEntropy, passwordTool,
  // lorem
  makeRng, generateWords, generateSentences, generateParagraphs, loremTool,
  // markdown
  toHtml, markdownTool,
  // qr
  type ErrorCorrectionLevel, validateSvgColor, type QrOptions, generateSvgString, qrTool,
  // barcode
  type BarcodeFormat, ean13CheckDigit, upcaCheckDigit, ean8CheckDigit, generateBarcodeSvg, barcodeTool,
  // brand palette
  BRAND, CATEGORY_COLORS, type BrandColor,
};

export const TOOLS: ToolDef[] = [
  jsonTool,
  csvTool,
  hashTool,
  base64Tool,
  jwtTool,
  regexTool,
  cronTool,
  uuidTool,
  timestampTool,
  diffTool,
  unitsTool,
  coloursTool,
  passwordTool,
  loremTool,
  markdownTool,
  qrTool,
  barcodeTool,
];
