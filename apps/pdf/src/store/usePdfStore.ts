import { create } from "zustand";

export type Tool =
  | "merge"
  | "split"
  | "extract"
  | "reorder"
  | "rotate"
  | "compress"
  | "pagenumbers"
  | "watermark"
  | "img2pdf"
  | "pdf2img";

const TOOL_VALUES: Tool[] = [
  "merge",
  "split",
  "extract",
  "reorder",
  "rotate",
  "compress",
  "pagenumbers",
  "watermark",
  "img2pdf",
  "pdf2img",
];

function readStoredTool(): Tool {
  try {
    const raw = localStorage.getItem("pdf-active-tool");
    if (raw && TOOL_VALUES.includes(raw as Tool)) return raw as Tool;
  } catch {
    // localStorage unavailable (private mode etc.)
  }
  return "merge";
}

interface PdfStore {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
}

export const usePdfStore = create<PdfStore>((set) => ({
  activeTool: readStoredTool(),
  setActiveTool: (tool) => {
    try {
      localStorage.setItem("pdf-active-tool", tool);
    } catch {
      // ignore
    }
    set({ activeTool: tool });
  },
}));
