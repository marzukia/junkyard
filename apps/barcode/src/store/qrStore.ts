import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QrPreset, QrVCardOptions, QrWifiOptions } from "../lib/qr";
import { buildQrContent } from "../lib/qr";

export interface QrState {
  preset: QrPreset;
  rawInput: string;
  wifi: QrWifiOptions;
  vcard: QrVCardOptions;
  errorLevel: "L" | "M" | "Q" | "H";

  /** Derived: the actual QR content string to encode. */
  qrContent: string;

  setPreset: (p: QrPreset) => void;
  setRawInput: (s: string) => void;
  setWifi: (w: Partial<QrWifiOptions>) => void;
  setVCard: (v: Partial<QrVCardOptions>) => void;
  setErrorLevel: (l: "L" | "M" | "Q" | "H") => void;
}

const DEFAULT_WIFI: QrWifiOptions = {
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
};

const DEFAULT_VCARD: QrVCardOptions = {
  name: "",
  phone: "",
  email: "",
  org: "",
  url: "",
};

function deriveContent(
  preset: QrPreset,
  raw: string,
  wifi: QrWifiOptions,
  vcard: QrVCardOptions
): string {
  return buildQrContent(preset, raw, wifi, vcard);
}

export const useQrStore = create<QrState>()(
  persist(
    (set, get) => ({
      preset: "text",
      rawInput: "Hello, World!",
      wifi: DEFAULT_WIFI,
      vcard: DEFAULT_VCARD,
      errorLevel: "M",
      qrContent: "Hello, World!",

      setPreset: (preset) => {
        const { rawInput, wifi, vcard } = get();
        set({ preset, qrContent: deriveContent(preset, rawInput, wifi, vcard) });
      },

      setRawInput: (rawInput) => {
        const { preset, wifi, vcard } = get();
        set({ rawInput, qrContent: deriveContent(preset, rawInput, wifi, vcard) });
      },

      setWifi: (partial) => {
        const { preset, rawInput, wifi, vcard } = get();
        const next = { ...wifi, ...partial };
        set({ wifi: next, qrContent: deriveContent(preset, rawInput, next, vcard) });
      },

      setVCard: (partial) => {
        const { preset, rawInput, wifi, vcard } = get();
        const next = { ...vcard, ...partial };
        set({ vcard: next, qrContent: deriveContent(preset, rawInput, wifi, next) });
      },

      setErrorLevel: (errorLevel) => set({ errorLevel }),
    }),
    {
      name: "qr-settings",
      partialize: (state) => ({
        preset: state.preset,
        rawInput: state.rawInput,
        wifi: state.wifi,
        vcard: state.vcard,
        errorLevel: state.errorLevel,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.qrContent = deriveContent(state.preset, state.rawInput, state.wifi, state.vcard);
        }
      },
    }
  )
);
