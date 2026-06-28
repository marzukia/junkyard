#!/usr/bin/env node
// Reads apps/*/junkyard.ts, validates, sorts by order, and emits:
//   hub/src/catalogue.generated.ts  - typed TOOLS array for the hub
//   hub/public/catalogue.json       - full catalogue for nav switcher and MCP server
// Run via: npx tsx scripts/gen-catalogue.ts

import { writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import type { JunkyardApp, McpTool, AppTag } from "./catalogue-schema.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APPS_DIR = join(ROOT, "apps");
const OUT_TS = join(ROOT, "hub", "src", "catalogue.generated.ts");
const OUT_JSON = join(ROOT, "hub", "public", "catalogue.json");

const VALID_CATEGORIES = new Set<string>(["image", "text", "ai", "docs"]);
const VALID_RUNTIMES = new Set<string>(["client", "client-ai"]);
const VALID_TAGS = new Set<AppTag>(["webgpu", "on-device-ai", "large-download", "beta"]);

// Zod schema for JunkyardApp — validates app exports at build time.
// Runs alongside the manual checks below; zod catches type errors that
// manual field checks miss (wrong types, unexpected nested shapes).
const AppTagEnum = z.enum(["webgpu", "on-device-ai", "large-download", "beta"]);
const McpToolSchema = z.object({
  name: z.string().min(1),
  summary: z.string().optional(),
});
const JunkyardAppSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["image", "text", "ai", "docs"]),
  order: z.number().int().positive(),
  tagline: z.string().min(1),
  description: z.string().min(1),
  incumbent: z.string(),
  path: z.string().min(1),
  runtime: z.enum(["client", "client-ai"]),
  mcp: z.object({
    exposed: z.boolean(),
    lib: z.string(),
    tools: z.array(McpToolSchema),
  }),
  tags: z.array(AppTagEnum).optional(),
});

const REQUIRED_FIELDS: (keyof JunkyardApp)[] = [
  "slug",
  "name",
  "category",
  "order",
  "tagline",
  "description",
  "incumbent",
  "path",
  "runtime",
  "mcp",
];

const DESC_MIN_LENGTH = 40;
const DESC_TERMINAL_RE = /[.!?]$/;

function validateDescription(desc: string, tsPath: string): string[] {
  const errs: string[] = [];
  if (desc.length < DESC_MIN_LENGTH) {
    errs.push(
      `${tsPath}: description too short (${desc.length} chars, min ${DESC_MIN_LENGTH}) - "${desc}"`,
    );
  } else if (!DESC_TERMINAL_RE.test(desc)) {
    errs.push(
      `${tsPath}: description does not end with sentence-ending punctuation (.!?) - "${desc}"`,
    );
  }
  return errs;
}

function validateMcpTools(tools: unknown, tsPath: string): string[] {
  const errs: string[] = [];
  if (!Array.isArray(tools)) {
    errs.push(`${tsPath}: mcp.tools must be an array`);
    return errs;
  }
  for (let i = 0; i < tools.length; i++) {
    const entry = tools[i];
    if (!entry || typeof entry !== "object") {
      errs.push(`${tsPath}: mcp.tools[${i}] must be an object`);
      continue;
    }
    const t = entry as Record<string, unknown>;
    if (typeof t.name !== "string" || t.name.trim() === "") {
      errs.push(`${tsPath}: mcp.tools[${i}].name must be a non-empty string`);
    }
    if ("summary" in t && typeof t.summary !== "string") {
      errs.push(`${tsPath}: mcp.tools[${i}].summary must be a string if present`);
    }
  }
  return errs;
}

async function main(): Promise<void> {
  // Collect all app directory names
  const appDirs = readdirSync(APPS_DIR).filter((name) => {
    try {
      return statSync(join(APPS_DIR, name)).isDirectory();
    } catch {
      return false;
    }
  });

  const tools: JunkyardApp[] = [];
  // All errors across all apps accumulated before exit so every problem is reported
  const allErrors: string[] = [];

  for (const dir of appDirs) {
    const tsPath = join(APPS_DIR, dir, "junkyard.ts");
    let mod: { app: JunkyardApp };

    try {
      mod = await import(pathToFileURL(tsPath).href);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      allErrors.push(`Failed to import ${tsPath}: ${msg}`);
      continue;
    }

    const data = mod.app;

    if (!data || typeof data !== "object") {
      allErrors.push(`${tsPath}: export "app" is missing or not an object`);
      continue;
    }

    // Zod validation pass — catches type errors that manual checks miss
    const zodResult = JunkyardAppSchema.safeParse(data);
    if (!zodResult.success) {
      for (const issue of zodResult.error.issues) {
        allErrors.push(`${tsPath}: ${issue.path.join(".")} — ${issue.message}`);
      }
    }

    // Per-app error list - collect ALL field errors before skipping this app
    const appErrors: string[] = [];

    // Required fields
    for (const field of REQUIRED_FIELDS) {
      if (data[field] === undefined || data[field] === null) {
        appErrors.push(`${tsPath}: missing required field "${field}"`);
      }
    }

    // Only run deeper validation when required fields are present
    if (appErrors.length === 0) {
      // Category validation
      if (!VALID_CATEGORIES.has(data.category)) {
        appErrors.push(
          `${tsPath}: category "${data.category}" not in [image, text, ai, docs]`,
        );
      }

      // Runtime validation
      if (!VALID_RUNTIMES.has(data.runtime)) {
        appErrors.push(
          `${tsPath}: runtime "${data.runtime}" not in [client, client-ai]`,
        );
      }

      // Slug must match directory name
      if (data.slug !== dir) {
        appErrors.push(
          `${tsPath}: slug "${data.slug}" does not match directory name "${dir}"`,
        );
      }

      // Path must be the canonical derivative of slug: "/<slug>/"
      // Guards against fat-fingered paths and stale paths after a slug rename.
      const expectedPath = `/${data.slug}/`;
      if (data.path !== expectedPath) {
        appErrors.push(
          `${tsPath}: path "${data.path}" must be "${expectedPath}"`,
        );
      }

      // Order must be a positive integer
      if (!Number.isInteger(data.order) || data.order < 1) {
        appErrors.push(
          `${tsPath}: order must be a positive integer, got ${JSON.stringify(data.order)}`,
        );
      }

      // Description quality: min length and terminal punctuation
      appErrors.push(...validateDescription(data.description, tsPath));

      // mcp.tools shape validation
      appErrors.push(...validateMcpTools(data.mcp?.tools, tsPath));

      // tags validation (optional field, but each value must be a known AppTag)
      if (data.tags !== undefined) {
        if (!Array.isArray(data.tags)) {
          appErrors.push(`${tsPath}: tags must be an array if present`);
        } else {
          for (const tag of data.tags) {
            if (!VALID_TAGS.has(tag as AppTag)) {
              appErrors.push(
                `${tsPath}: unknown tag "${tag}" - valid tags are [${[...VALID_TAGS].join(", ")}]`,
              );
            }
          }
        }
      }
    }

    if (appErrors.length > 0) {
      allErrors.push(...appErrors);
    } else {
      tools.push(data);
    }
  }

  if (allErrors.length > 0) {
    for (const err of allErrors) {
      process.stderr.write(`ERROR: ${err}\n`);
    }
    process.exit(1);
  }

  // Def count must equal app-dir count
  if (tools.length !== appDirs.length) {
    process.stderr.write(
      `ERROR: found ${tools.length} valid junkyard.ts files but ${appDirs.length} app directories - a definition is missing or invalid\n`,
    );
    process.exit(1);
  }

  // Order values must be unique
  const orderSet = new Set(tools.map((t) => t.order));
  if (orderSet.size !== tools.length) {
    const seen = new Set<number>();
    const dupes: string[] = [];
    for (const t of tools) {
      if (seen.has(t.order)) dupes.push(`order ${t.order} (slug: ${t.slug})`);
      seen.add(t.order);
    }
    process.stderr.write(`ERROR: duplicate order values: ${dupes.join(", ")}\n`);
    process.exit(1);
  }

  // Order set must be exactly 1..N
  const N = tools.length;
  for (let i = 1; i <= N; i++) {
    if (!orderSet.has(i)) {
      process.stderr.write(
        `ERROR: order values must be exactly 1..${N}, but ${i} is missing\n`,
      );
      process.exit(1);
    }
  }

  // Sort by order ascending
  tools.sort((a, b) => a.order - b.order);

  // Emit catalogue.generated.ts (Tool fields: name, slug, yard=category, tagline, incumbent, tags, mcpExposed)
  const tsLines = [
    `// AUTO-GENERATED by scripts/gen-catalogue.ts from apps/*/junkyard.ts. DO NOT EDIT.`,
    `import type { Tool } from "./tools";`,
    ``,
    `export const TOOLS: Tool[] = [`,
  ];

  for (const t of tools) {
    tsLines.push(`  {`);
    tsLines.push(`    name: ${JSON.stringify(t.name)},`);
    tsLines.push(`    slug: ${JSON.stringify(t.slug)},`);
    tsLines.push(`    yard: ${JSON.stringify(t.category)},`);
    tsLines.push(`    tagline: ${JSON.stringify(t.tagline)},`);
    tsLines.push(`    incumbent: ${JSON.stringify(t.incumbent)},`);
    if (t.tags && t.tags.length > 0) {
      const tagList = t.tags.map((tag) => JSON.stringify(tag)).join(", ");
      tsLines.push(`    tags: [${tagList}],`);
    }
    tsLines.push(`    mcpExposed: ${t.mcp.exposed},`);
    tsLines.push(`  },`);
  }

  tsLines.push(`];`);
  tsLines.push(``);

  writeFileSync(OUT_TS, tsLines.join("\n"), "utf-8");

  // Emit catalogue.json (full catalogue, all fields, plain JSON array)
  writeFileSync(OUT_JSON, JSON.stringify(tools, null, 2) + "\n", "utf-8");

  process.stdout.write(`generated ${tools.length} tools\n`);
}

main();
