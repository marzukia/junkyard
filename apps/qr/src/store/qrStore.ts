import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DotStyle, ErrorCorrectionLevel } from "../lib/qr";

interface QRState {
  text: string;
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotStyle: DotStyle;
  logoDataUrl: string | null;
  logoFileName: string | null;

  setText: (text: string) => void;
  setFgColor: (color: string) => void;
  setBgColor: (color: string) => void;
  setErrorCorrectionLevel: (level: ErrorCorrectionLevel) => void;
  setDotStyle: (style: DotStyle) => void;
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
      logoDataUrl: null,
      logoFileName: null,

      setText: (text) => set({ text }),
      setFgColor: (fgColor) => set({ fgColor }),
      setBgColor: (bgColor) => set({ bgColor }),
      setErrorCorrectionLevel: (errorCorrectionLevel) => set({ errorCorrectionLevel }),
      setDotStyle: (dotStyle) => set({ dotStyle }),
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
      }),
    }
  )
);
