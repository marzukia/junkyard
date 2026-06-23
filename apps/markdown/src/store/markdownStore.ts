import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_MD = `# Welcome to Markdown Editor

Write **markdown** on the left, see live HTML on the right.

## Features

- GitHub Flavored Markdown (GFM)
- Bold, headings, links, code toolbar
- Export HTML or copy to clipboard
- Word count
- Runs entirely in your browser

## Example

> Block quotes look great.

\`\`\`js
const greet = (name) => \`Hello, \${name}!\`;
\`\`\`

| Column A | Column B |
|----------|----------|
| Value 1  | Value 2  |

---

*Made by [Andryo Marzuki](https://mrzk.io)*
`;

interface MarkdownState {
  source: string;
  setSource: (s: string) => void;
  clearSource: () => void;
}

export const useMarkdownStore = create<MarkdownState>()(
  persist(
    (set) => ({
      source: DEFAULT_MD,
      setSource: (s) => set({ source: s }),
      clearSource: () => set({ source: "" }),
    }),
    { name: "md-editor-source" }
  )
);

export { DEFAULT_MD };
