import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { IndentOption, ParseError, QueryResult } from "../lib/json";
import { buildTree, formatJson, minifyJson, parseJson, queryJsonPath, sortKeys } from "../lib/json";
import type { TreeNode } from "../lib/json";

export type ViewMode = "formatted" | "minified" | "tree";

interface JsonState {
  input: string;
  output: string;
  viewMode: ViewMode;
  indent: IndentOption;
  sortKeysEnabled: boolean;
  queryExpr: string;
  queryResults: QueryResult[] | null;
  queryError: string | null;
  parseError: ParseError | null;
  tree: TreeNode | null;
  processing: boolean;
  // actions
  setInput: (v: string) => void;
  setViewMode: (m: ViewMode) => void;
  setIndent: (i: IndentOption) => void;
  setSortKeys: (v: boolean) => void;
  setQueryExpr: (q: string) => void;
  clearInput: () => void;
}

// Large input threshold: above this we yield to the event loop before processing
const LARGE_THRESHOLD = 200_000;

function deriveSync(
  input: string,
  viewMode: ViewMode,
  indent: IndentOption,
  sortKeysEnabled: boolean
): { output: string; parseError: ParseError | null; tree: TreeNode | null } {
  if (!input.trim()) {
    return { output: "", parseError: null, tree: null };
  }

  const result = parseJson(input);
  if (!result.ok) {
    return { output: input, parseError: result.error, tree: null };
  }

  const value = sortKeysEnabled ? sortKeys(result.value) : result.value;

  let output = input;
  let tree: TreeNode | null = null;

  if (viewMode === "formatted") {
    try {
      output = formatJson(JSON.stringify(value), indent);
    } catch {
      output = input;
    }
  } else if (viewMode === "minified") {
    try {
      output = minifyJson(JSON.stringify(value));
    } catch {
      output = input;
    }
  } else {
    // tree view: also format the textarea
    try {
      output = formatJson(JSON.stringify(value), indent);
    } catch {
      output = input;
    }
    try {
      tree = buildTree(value);
    } catch {
      tree = null;
    }
  }

  return { output, parseError: null, tree };
}

function deriveQuery(
  input: string,
  queryExpr: string
): { queryResults: QueryResult[] | null; queryError: string | null } {
  if (!queryExpr.trim() || !input.trim()) {
    return { queryResults: null, queryError: null };
  }
  try {
    const result = parseJson(input);
    if (!result.ok) return { queryResults: null, queryError: "Fix JSON errors first" };
    const results = queryJsonPath(result.value, queryExpr);
    return { queryResults: results, queryError: null };
  } catch (e) {
    return { queryResults: null, queryError: String(e) };
  }
}

// debounce timer ref (module-level, not in Zustand state to avoid reactivity loop)
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useJsonStore = create<JsonState>()(
  persist(
    (set, get) => ({
      input: "",
      output: "",
      viewMode: "formatted" as ViewMode,
      indent: 2 as IndentOption,
      sortKeysEnabled: false,
      queryExpr: "",
      queryResults: null,
      queryError: null,
      parseError: null,
      tree: null,
      processing: false,

      setInput: (input) => {
        const { viewMode, indent, sortKeysEnabled, queryExpr } = get();

        if (input.length > LARGE_THRESHOLD) {
          // Show processing state immediately, then compute after yield
          set({ input, processing: true });
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const derived = deriveSync(input, viewMode, indent, sortKeysEnabled);
            const q = deriveQuery(input, queryExpr);
            set({ ...derived, ...q, processing: false });
          }, 60);
        } else {
          const derived = deriveSync(input, viewMode, indent, sortKeysEnabled);
          const q = deriveQuery(input, queryExpr);
          set({ input, ...derived, ...q, processing: false });
        }
      },

      setViewMode: (viewMode) => {
        const { input, indent, sortKeysEnabled } = get();
        const derived = deriveSync(input, viewMode, indent, sortKeysEnabled);
        set({ viewMode, ...derived });
      },

      setIndent: (indent) => {
        const { input, viewMode, sortKeysEnabled } = get();
        const derived = deriveSync(input, viewMode, indent, sortKeysEnabled);
        set({ indent, ...derived });
      },

      setSortKeys: (sortKeysEnabled) => {
        const { input, viewMode, indent } = get();
        const derived = deriveSync(input, viewMode, indent, sortKeysEnabled);
        set({ sortKeysEnabled, ...derived });
      },

      setQueryExpr: (queryExpr) => {
        const { input } = get();
        const q = deriveQuery(input, queryExpr);
        set({ queryExpr, ...q });
      },

      clearInput: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        set({
          input: "",
          output: "",
          parseError: null,
          tree: null,
          processing: false,
          queryResults: null,
          queryError: null,
        });
      },
    }),
    {
      name: "json-tool-prefs",
      // Only persist user preferences (mode/indent/sort), not ephemeral data
      partialize: (state) => ({
        viewMode: state.viewMode,
        indent: state.indent,
        sortKeysEnabled: state.sortKeysEnabled,
      }),
    }
  )
);
