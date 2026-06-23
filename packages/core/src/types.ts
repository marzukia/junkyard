import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolOp<I = any, O = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  run: (input: I) => O | Promise<O>;
}

export interface ToolDef {
  slug: string;
  name: string;
  ops: ToolOp[];
}
