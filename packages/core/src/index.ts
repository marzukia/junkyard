export type { ToolOp, ToolDef } from "./types.js";

export * from "./json.js";
export * from "./csv.js";
export * from "./hash.js";
export * from "./base64.js";
export * from "./jwt.js";
export * from "./regex.js";
export * from "./cron.js";
export * from "./uuid.js";
export * from "./timestamp.js";
export * from "./diff.js";
export * from "./units.js";
export * from "./colours.js";
export * from "./password.js";
export * from "./lorem.js";
export * from "./markdown.js";
export * from "./qr.js";
export * from "./barcode.js";

import { jsonTool } from "./json.js";
import { csvTool } from "./csv.js";
import { hashTool } from "./hash.js";
import { base64Tool } from "./base64.js";
import { jwtTool } from "./jwt.js";
import { regexTool } from "./regex.js";
import { cronTool } from "./cron.js";
import { uuidTool } from "./uuid.js";
import { timestampTool } from "./timestamp.js";
import { diffTool } from "./diff.js";
import { unitsTool } from "./units.js";
import { coloursTool } from "./colours.js";
import { passwordTool } from "./password.js";
import { loremTool } from "./lorem.js";
import { markdownTool } from "./markdown.js";
import { qrTool } from "./qr.js";
import { barcodeTool } from "./barcode.js";

import type { ToolDef } from "./types.js";

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
