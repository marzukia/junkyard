/**
 * Lorem ipsum generation. Pure logic lifted from apps/lorem/src/lib/lorem.ts.
 * No browser globals.
 */
import { z } from "zod";
import type { ToolDef } from "./types.js";

const WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
  "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
  "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
  "deserunt", "mollit", "anim", "id", "est", "laborum",
];

export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function pickWord(rng: () => number): string {
  return WORDS[Math.floor(rng() * WORDS.length)];
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export function generateWords(count: number, seed = 1): string {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => pickWord(rng)).join(" ");
}

function generateSentence(rng: () => number): string {
  const len = 6 + Math.floor(rng() * 11);
  const words: string[] = [];
  for (let i = 0; i < len; i++) words.push(pickWord(rng));
  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0) result.push(cap(words[i]));
    else if (i > 2 && i < words.length - 1 && rng() < 0.25) result.push(`${words[i]},`);
    else result.push(words[i]);
  }
  return `${result.join(" ")}.`;
}

export function generateSentences(count: number, seed = 1): string {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => generateSentence(rng)).join(" ");
}

export function generateParagraphs(count: number, seed = 1): string {
  const rng = makeRng(seed);
  const paras: string[] = [];
  for (let i = 0; i < count; i++) {
    const sentenceCount = 3 + Math.floor(rng() * 5);
    const sentences: string[] = [];
    for (let j = 0; j < sentenceCount; j++) sentences.push(generateSentence(rng));
    paras.push(sentences.join(" "));
  }
  return paras.join("\n\n");
}

// ── ToolDef ──────────────────────────────────────────────────────────────────

export const loremTool: ToolDef = {
  slug: "lorem",
  name: "Lorem Ipsum",
  ops: [
    {
      name: "generate",
      description: "Generate lorem ipsum placeholder text (words, sentences, or paragraphs)",
      inputSchema: z.object({
        kind: z.enum(["words", "sentences", "paragraphs"]).default("paragraphs"),
        count: z.number().int().min(1).max(500).default(3),
        seed: z.number().int().default(1),
      }),
      run({ kind, count, seed }) {
        let text: string;
        if (kind === "words") text = generateWords(count, seed);
        else if (kind === "sentences") text = generateSentences(count, seed);
        else text = generateParagraphs(count, seed);
        return { text };
      },
    },
  ],
};
