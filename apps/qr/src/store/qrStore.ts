import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DotStyle, ErrorCorrectionLevel, EyeStyle } from "../lib/qr";

interface QRState {
  text: string;
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  logoDataUrl: string | null;
  logoFileName: string | null;

  setText: (text: string) => void;
  setFgColor: (color: string) => void;
  setBgColor: (color: string) => void;
  setErrorCorrectionLevel: (level: ErrorCorrectionLevel) => void;
  setDotStyle: (style: DotStyle) => void;
  setEyeStyle: (style: EyeStyle) => void;
  setLogo: (dataUrl: string, fileName: string) => void;
  clearLogo: () => void;
}

export const useQRStore = create<QRState>()(
  persist(
    (set) => ({
      text: "https://mrzk.io",
      fgColor: "#1a2530",
      bgColor: "#ffffff",
      errorCorrectionLevel: "M",
      dotStyle: "square",
      eyeStyle: "square",
      logoDataUrl: null,
      logoFileName: null,

      setText: (text) => set({ text }),
      setFgColor: (fgColor) => set({ fgColor }),
      setBgColor: (bgColor) => set({ bgColor }),
      setErrorCorrectionLevel: (errorCorrectionLevel) => set({ errorCorrectionLevel }),
      setDotStyle: (dotStyle) => set({ dotStyle }),
      setEyeStyle: (eyeStyle) => set({ eyeStyle }),
      setLogo: (logoDataUrl, logoFileName) => set({ logoDataUrl, logoFileName }),
      clearLogo: () => set({ logoDataUrl: null, logoFileName: null }),
    }),
    {
      name: "qr-settings",
      // Only persist settings, not logo (large data URL) to avoid storage quota issues
      partialize: (state) => ({
        fgColor: state.fgColor,
        bgColor: state.bgColor,
        errorCorrectionLevel: state.errorCorrectionLevel,
        dotStyle: state.dotStyle,
        eyeStyle: state.eyeStyle,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<QRState>;
        const VALID_ECL: ErrorCorrectionLevel[] = ["L", "M", "Q", "H"];
        const VALID_DOT: DotStyle[] = ["square", "rounded", "dots", "classy"];
        const VALID_EYE: EyeStyle[] = ["square", "rounded", "circle", "leaf"];
        return {
          ...current,
          // Guard text: not in partialize but could be injected by a poisoned store.
          text: typeof p.text === "string" ? p.text : current.text,
          fgColor: typeof p.fgColor === "string" ? p.fgColor : current.fgColor,
          bgColor: typeof p.bgColor === "string" ? p.bgColor : current.bgColor,
          errorCorrectionLevel:
            typeof p.errorCorrectionLevel === "string" &&
            VALID_ECL.includes(p.errorCorrectionLevel as ErrorCorrectionLevel)
              ? (p.errorCorrectionLevel as ErrorCorrectionLevel)
              : current.errorCorrectionLevel,
          dotStyle:
            typeof p.dotStyle === "string" && VALID_DOT.includes(p.dotStyle as DotStyle)
              ? (p.dotStyle as DotStyle)
              : current.dotStyle,
          eyeStyle:
            typeof p.eyeStyle === "string" && VALID_EYE.includes(p.eyeStyle as EyeStyle)
              ? (p.eyeStyle as EyeStyle)
              : current.eyeStyle,
        };
      },
    }
  )
);
