import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type CopyFormat,
  type NamespaceKey,
  type OutputFormat,
  UUID_NAMESPACES,
  type UuidKind,
  applyOptions,
  generateBatch,
  generateNameBased,
} from "../lib/uuid";

// Extended kind includes name-based variants
export type ExtendedKind = UuidKind | "v3" | "v5";

interface UuidStore {
  // config (persisted)
  kind: ExtendedKind;
  count: number;
  uppercase: boolean;
  noDashes: boolean;
  outputFormat: OutputFormat;
  copyFormat: CopyFormat;
  // v3/v5 config (persisted)
  namespaceName: NamespaceKey;
  nameValue: string;
  // output (not persisted -- always regenerate on load)
  ids: string[];
  isGenerating: boolean;
  // actions
  setKind: (kind: ExtendedKind) => void;
  setCount: (count: number) => void;
  setUppercase: (v: boolean) => void;
  setNoDashes: (v: boolean) => void;
  setOutputFormat: (f: OutputFormat) => void;
  setCopyFormat: (f: CopyFormat) => void;
  setNamespaceName: (n: NamespaceKey) => void;
  setNameValue: (v: string) => void;
  generate: () => void;
}

function isNameBased(kind: ExtendedKind): kind is "v3" | "v5" {
  return kind === "v3" || kind === "v5";
}

export const useUuidStore = create<UuidStore>()(
  persist(
    (set, get) => {
      function buildAndSet(overrides: Partial<UuidStore> = {}) {
        const state = { ...get(), ...overrides };
        const { uppercase, noDashes, outputFormat } = state;
        const opts = { uppercase, noDashes, format: outputFormat };

        if (isNameBased(state.kind)) {
          // Async path for v3/v5
          set({ isGenerating: true, ...overrides });
          const ns = UUID_NAMESPACES[state.namespaceName];
          generateNameBased(state.kind, ns, state.nameValue || "example", state.count)
            .then((raw) => {
              set({ ids: raw.map((id) => applyOptions(id, opts)), isGenerating: false });
            })
            .catch(() => {
              set({ ids: [], isGenerating: false });
            });
        } else {
          // Sync path for v4/v7/v1/nanoid/ulid
          const raw = generateBatch(state.kind as UuidKind, state.count);
          set({ ids: raw.map((id) => applyOptions(id, opts)), isGenerating: false, ...overrides });
        }
      }

      return {
        kind: "v4",
        count: 5,
        uppercase: false,
        noDashes: false,
        outputFormat: "plain",
        copyFormat: "newline",
        namespaceName: "DNS",
        nameValue: "",
        ids: [],
        isGenerating: false,

        setKind: (kind) => buildAndSet({ kind }),
        setCount: (count) => buildAndSet({ count }),
        setUppercase: (uppercase) => buildAndSet({ uppercase }),
        setNoDashes: (noDashes) => buildAndSet({ noDashes }),
        setOutputFormat: (outputFormat) => buildAndSet({ outputFormat }),
        setCopyFormat: (copyFormat) => set({ copyFormat }),
        setNamespaceName: (namespaceName) => buildAndSet({ namespaceName }),
        setNameValue: (nameValue) => buildAndSet({ nameValue }),

        generate: () => buildAndSet(),
      };
    },
    {
      name: "uuid-tool-prefs",
      // Only persist config, never the generated ids
      partialize: (state) => ({
        kind: state.kind,
        count: state.count,
        uppercase: state.uppercase,
        noDashes: state.noDashes,
        outputFormat: state.outputFormat,
        copyFormat: state.copyFormat,
        namespaceName: state.namespaceName,
        nameValue: state.nameValue,
      }),
    }
  )
);
