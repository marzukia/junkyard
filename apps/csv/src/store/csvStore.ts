import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ConvertMode,
  type Delimiter,
  type OutputFormat,
  type ParsedCsv,
  csvToJson,
  csvToMarkdown,
  csvToSql,
  csvToXml,
  csvToYaml,
  detectDelimiter,
  jsonToCsv,
  parseCsv,
} from "../lib/csv";

export type SortDir = "asc" | "desc" | null;

interface SortState {
  col: number;
  dir: SortDir;
}

interface CsvState {
  mode: ConvertMode;
  input: string;
  delimiter: Delimiter;
  autoDelimiter: boolean;
  hasHeader: boolean;
  outputFormat: OutputFormat;
  parsed: ParsedCsv | null;
  parseError: string | null;
  output: string;
  outputError: string | null;
  sort: SortState;

  setMode: (m: ConvertMode) => void;
  setInput: (text: string) => void;
  setDelimiter: (d: Delimiter) => void;
  setAutoDelimiter: (v: boolean) => void;
  setHasHeader: (v: boolean) => void;
  setOutputFormat: (f: OutputFormat) => void;
  setSort: (col: number) => void;
}

function renderOutput(
  format: OutputFormat,
  parsed: ParsedCsv
): Pick<CsvState, "output" | "outputError"> {
  let result: { ok: boolean; value?: string; error?: { message: string } };

  switch (format) {
    case "json":
      result = csvToJson(parsed);
      break;
    case "markdown":
      result = csvToMarkdown(parsed);
      break;
    case "sql":
      result = csvToSql(parsed);
      break;
    case "xml":
      result = csvToXml(parsed);
      break;
    case "yaml":
      result = csvToYaml(parsed);
      break;
    default:
      result = csvToJson(parsed);
  }

  if (!result.ok) {
    return { output: "", outputError: result.error?.message ?? "Conversion failed." };
  }
  return { output: result.value ?? "", outputError: null };
}

function runConversion(
  mode: ConvertMode,
  input: string,
  delimiter: Delimiter,
  hasHeader: boolean,
  autoDetect: boolean,
  outputFormat: OutputFormat
): Pick<CsvState, "parsed" | "parseError" | "output" | "outputError" | "delimiter"> {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      delimiter,
      parsed: null,
      parseError: null,
      output: "",
      outputError: null,
    };
  }

  if (mode === "csv-to-json") {
    const effectiveDelim = autoDetect ? detectDelimiter(trimmed) : delimiter;
    const parseResult = parseCsv(trimmed, { delimiter: effectiveDelim, hasHeader });
    if (!parseResult.ok) {
      return {
        delimiter: effectiveDelim,
        parsed: null,
        parseError: parseResult.error.message,
        output: "",
        outputError: null,
      };
    }
    const { output, outputError } = renderOutput(outputFormat, parseResult.value);
    return {
      delimiter: effectiveDelim,
      parsed: parseResult.value,
      parseError: null,
      output,
      outputError,
    };
  }

  // json-to-csv
  const result = jsonToCsv(trimmed, delimiter);
  return {
    delimiter,
    parsed: null,
    parseError: null,
    output: result.ok ? result.value : "",
    outputError: result.ok ? null : result.error.message,
  };
}

export const useCsvStore = create<CsvState>()(
  persist(
    (set, get) => ({
      mode: "csv-to-json",
      input: "",
      delimiter: ",",
      autoDelimiter: true,
      hasHeader: true,
      outputFormat: "json",
      parsed: null,
      parseError: null,
      output: "",
      outputError: null,
      sort: { col: -1, dir: null },

      setMode: (mode) => {
        const { input, delimiter, hasHeader, autoDelimiter, outputFormat } = get();
        const updates = runConversion(
          mode,
          input,
          delimiter,
          hasHeader,
          autoDelimiter,
          outputFormat
        );
        set({ mode, sort: { col: -1, dir: null }, ...updates });
      },

      setInput: (input) => {
        const { mode, delimiter, hasHeader, autoDelimiter, outputFormat } = get();
        const updates = runConversion(
          mode,
          input,
          delimiter,
          hasHeader,
          autoDelimiter,
          outputFormat
        );
        set({ input, sort: { col: -1, dir: null }, ...updates });
      },

      setDelimiter: (delimiter) => {
        const { mode, input, hasHeader, outputFormat } = get();
        const updates = runConversion(mode, input, delimiter, hasHeader, false, outputFormat);
        set({ autoDelimiter: false, sort: { col: -1, dir: null }, ...updates, delimiter });
      },

      setAutoDelimiter: (autoDelimiter) => {
        const { mode, input, delimiter, hasHeader, outputFormat } = get();
        const updates = runConversion(
          mode,
          input,
          delimiter,
          hasHeader,
          autoDelimiter,
          outputFormat
        );
        set({ autoDelimiter, ...updates });
      },

      setHasHeader: (hasHeader) => {
        const { mode, input, delimiter, autoDelimiter, outputFormat } = get();
        const updates = runConversion(
          mode,
          input,
          delimiter,
          hasHeader,
          autoDelimiter,
          outputFormat
        );
        set({ hasHeader, sort: { col: -1, dir: null }, ...updates });
      },

      setOutputFormat: (outputFormat) => {
        const { parsed } = get();
        if (parsed) {
          const { output, outputError } = renderOutput(outputFormat, parsed);
          set({ outputFormat, output, outputError, sort: { col: -1, dir: null } });
        } else {
          set({ outputFormat });
        }
      },

      setSort: (col) => {
        const { sort } = get();
        if (sort.col !== col) {
          set({ sort: { col, dir: "asc" } });
        } else if (sort.dir === "asc") {
          set({ sort: { col, dir: "desc" } });
        } else {
          set({ sort: { col: -1, dir: null } });
        }
      },
    }),
    {
      name: "csv-tool-prefs",
      // Only persist user preferences, not transient parse/output state
      partialize: (state) => ({
        mode: state.mode,
        delimiter: state.delimiter,
        autoDelimiter: state.autoDelimiter,
        hasHeader: state.hasHeader,
        outputFormat: state.outputFormat,
      }),
    }
  )
);
