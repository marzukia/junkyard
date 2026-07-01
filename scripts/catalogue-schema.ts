import { z } from "zod";

export type Category = "image" | "text" | "ai" | "docs";
export type Runtime = "client" | "client-ai";
export type AppTag = "webgpu" | "on-device-ai" | "large-download" | "beta";

export interface McpTool {
  name: string;
  summary?: string;
}

export interface JunkyardApp {
  slug: string;
  name: string;
  category: Category;
  order: number;
  tagline: string;
  description: string;
  incumbent: string;
  path: string;
  runtime: Runtime;
  mcp: { exposed: boolean; lib: string; tools: McpTool[] };
  tags?: AppTag[];
}

/** Zod schema for runtime validation of junkyard.ts exports */
export const JunkyardAppSchema = z.object({
  slug: z.string(),
  name: z.string(),
  category: z.enum(["image", "text", "ai", "docs"]),
  order: z.number().int().positive(),
  tagline: z.string(),
  description: z.string().min(40),
  incumbent: z.string(),
  path: z.string(),
  runtime: z.enum(["client", "client-ai"]),
  mcp: z.object({
    exposed: z.boolean(),
    lib: z.string(),
    tools: z.array(
      z.object({
        name: z.string().min(1),
        summary: z.string().optional(),
      }),
    ),
  }),
  tags: z.array(z.enum(["webgpu", "on-device-ai", "large-download", "beta"])).optional(),
});
