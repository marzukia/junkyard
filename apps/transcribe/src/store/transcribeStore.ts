import { create } from "zustand";
import type { TranscriptChunk } from "../lib/transcription";

export type Phase = "idle" | "model-loading" | "decoding" | "transcribing" | "done" | "error";

/** Monotonic phase rank: higher = further along the pipeline. */
const PHASE_RANK: Record<Phase, number> = {
  idle: 0,
  "model-loading": 1,
  decoding: 2,
  transcribing: 3,
  done: 4,
  error: 4,
};

/** ISO 639-1 language codes supported by Whisper, plus "auto" for auto-detect. */
export type LanguageHint =
  | "auto"
  | "en"
  | "zh"
  | "de"
  | "es"
  | "fr"
  | "it"
  | "ja"
  | "ko"
  | "pt"
  | "ru"
  | "ar"
  | "hi"
  | "nl"
  | "pl"
  | "sv"
  | "tr";

export const LANGUAGE_OPTIONS: { value: LanguageHint; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "zh", label: "Chinese" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "tr", label: "Turkish" },
];

const LS_KEY_TRANSLATE = "transcribe:translate";

const LS_KEY = "transcribe:language";

function loadLanguage(): LanguageHint {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && LANGUAGE_OPTIONS.some((o) => o.value === stored)) {
      return stored as LanguageHint;
    }
  } catch {
    // localStorage unavailable (private browsing restrictions etc.)
  }
  return "auto";
}

function loadTranslate(): boolean {
  try {
    return localStorage.getItem(LS_KEY_TRANSLATE) === "1";
  } catch {
    return false;
  }
}

/** Transcription progress for long files: 0-100 or null when unknown. */
export interface TranscribeProgress {
  /** Elapsed seconds since transcription phase started. */
  elapsedSec: number;
  /** Chunks processed so far (from progress callback). */
  chunksProcessed: number;
}

interface ModelProgress {
  loaded: number;
  total: number;
  status: string;
}

interface TranscribeState {
  phase: Phase;
  inputFile: File | null;
  transcript: string;
  chunks: TranscriptChunk[];
  errorMsg: string | null;
  modelProgress: ModelProgress;
  language: LanguageHint;
  translateToEnglish: boolean;
  transcribeProgress: TranscribeProgress;
  // actions
  setInputFile: (file: File) => void;
  setPhase: (phase: Phase) => void;
  setModelProgress: (loaded: number, total: number, status: string) => void;
  setResult: (text: string, chunks: TranscriptChunk[]) => void;
  setError: (msg: string) => void;
  setLanguage: (lang: LanguageHint) => void;
  setTranslateToEnglish: (v: boolean) => void;
  setTranscribeProgress: (p: Partial<TranscribeProgress>) => void;
  reset: () => void;
}

const INITIAL: Pick<
  TranscribeState,
  | "phase"
  | "inputFile"
  | "transcript"
  | "chunks"
  | "errorMsg"
  | "modelProgress"
  | "transcribeProgress"
> = {
  phase: "idle",
  inputFile: null,
  transcript: "",
  chunks: [],
  errorMsg: null,
  modelProgress: { loaded: 0, total: 1, status: "" },
  transcribeProgress: { elapsedSec: 0, chunksProcessed: 0 },
};

export const useTranscribeStore = create<TranscribeState>((set) => ({
  ...INITIAL,
  language: loadLanguage(),
  translateToEnglish: loadTranslate(),

  setInputFile: (file) => set({ inputFile: file, transcript: "", chunks: [], errorMsg: null }),

  setPhase: (phase) =>
    set((s) => (phase === "idle" || PHASE_RANK[phase] >= PHASE_RANK[s.phase] ? { phase } : {})),

  setModelProgress: (loaded, total, status) => set({ modelProgress: { loaded, total, status } }),

  setResult: (text, chunks) => set({ transcript: text, chunks, phase: "done" }),

  setError: (msg) => set({ errorMsg: msg, phase: "error" }),

  setLanguage: (lang) => {
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch {
      // ignore
    }
    set({ language: lang });
  },

  setTranslateToEnglish: (v) => {
    try {
      localStorage.setItem(LS_KEY_TRANSLATE, v ? "1" : "0");
    } catch {
      // ignore
    }
    set({ translateToEnglish: v });
  },

  setTranscribeProgress: (p) =>
    set((s) => ({ transcribeProgress: { ...s.transcribeProgress, ...p } })),

  reset: () => set({ ...INITIAL }),
}));
