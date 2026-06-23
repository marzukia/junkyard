import { create } from "zustand";
import type { ConversionResult } from "../lib/timestamp";
import { convertEpoch, dateStringToEpoch, parseEpochString } from "../lib/timestamp";

// ── Timezone persistence ───────────────────────────────────────────────────────

const TZ_STORAGE_KEY = "ts-tool-timezone";

function loadPersistedTimezone(): string {
  try {
    return localStorage.getItem(TZ_STORAGE_KEY) ?? "UTC";
  } catch {
    return "UTC";
  }
}

function persistTimezone(tz: string): void {
  try {
    localStorage.setItem(TZ_STORAGE_KEY, tz);
  } catch {
    // storage unavailable — no-op
  }
}

export type InputMode = "epoch" | "date";

interface TimestampState {
  inputMode: InputMode;
  epochInput: string;
  dateInput: string;
  timezone: string;
  // derived
  result: ConversionResult | null;
  parseError: string | null;
  nowMs: number;
  // actions
  setInputMode: (m: InputMode) => void;
  setEpochInput: (v: string) => void;
  setDateInput: (v: string) => void;
  setTimezone: (tz: string) => void;
  setNow: (ms: number) => void;
  loadNow: () => void;
}

function deriveFromEpoch(
  epochInput: string,
  timezone: string,
  nowMs: number
): { result: ConversionResult | null; parseError: string | null } {
  if (epochInput.trim() === "") return { result: null, parseError: null };
  const parsed = parseEpochString(epochInput);
  if (!parsed) return { result: null, parseError: "Not a valid epoch number." };
  const result = convertEpoch(parsed.epochMs, timezone, nowMs);
  return { result, parseError: null };
}

function deriveFromDate(
  dateInput: string,
  timezone: string,
  nowMs: number
): { result: ConversionResult | null; parseError: string | null } {
  if (dateInput.trim() === "") return { result: null, parseError: null };
  const parsed = dateStringToEpoch(dateInput);
  if (!parsed) return { result: null, parseError: "Cannot parse that date string." };
  const result = convertEpoch(parsed.epochMs, timezone, nowMs);
  return { result, parseError: null };
}

export const useTimestampStore = create<TimestampState>((set, get) => ({
  inputMode: "epoch",
  epochInput: "",
  dateInput: "",
  timezone: loadPersistedTimezone(),
  result: null,
  parseError: null,
  nowMs: Date.now(),

  setInputMode: (inputMode) => {
    const { epochInput, dateInput, timezone, nowMs } = get();
    let derived: { result: ConversionResult | null; parseError: string | null };
    if (inputMode === "epoch") {
      derived = deriveFromEpoch(epochInput, timezone, nowMs);
    } else {
      derived = deriveFromDate(dateInput, timezone, nowMs);
    }
    set({ inputMode, ...derived });
  },

  setEpochInput: (epochInput) => {
    const { timezone, nowMs } = get();
    const derived = deriveFromEpoch(epochInput, timezone, nowMs);
    set({ epochInput, ...derived });
  },

  setDateInput: (dateInput) => {
    const { timezone, nowMs } = get();
    const derived = deriveFromDate(dateInput, timezone, nowMs);
    set({ dateInput, ...derived });
  },

  setTimezone: (timezone) => {
    const { inputMode, epochInput, dateInput, nowMs } = get();
    let derived: { result: ConversionResult | null; parseError: string | null };
    if (inputMode === "epoch") {
      derived = deriveFromEpoch(epochInput, timezone, nowMs);
    } else {
      derived = deriveFromDate(dateInput, timezone, nowMs);
    }
    persistTimezone(timezone);
    set({ timezone, ...derived });
  },

  setNow: (nowMs) => {
    const { inputMode, epochInput, dateInput, timezone } = get();
    let derived: { result: ConversionResult | null; parseError: string | null };
    if (inputMode === "epoch") {
      derived = deriveFromEpoch(epochInput, timezone, nowMs);
    } else {
      derived = deriveFromDate(dateInput, timezone, nowMs);
    }
    set({ nowMs, ...derived });
  },

  loadNow: () => {
    const nowMs = Date.now();
    const nowS = Math.floor(nowMs / 1000);
    const { timezone } = get();
    const derived = deriveFromEpoch(String(nowS), timezone, nowMs);
    set({ epochInput: String(nowS), inputMode: "epoch", nowMs, ...derived });
  },
}));
