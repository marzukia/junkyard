export type Category = "image" | "text" | "ai" | "docs";
export type Runtime = "client" | "client-ai";

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
  mcp: { exposed: boolean; lib: string; tools: unknown[] };
}
