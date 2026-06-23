import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CONFIG, TEMPLATES, applyTemplate } from "./ogLogic";
import type { BgType, FontPreset, Layout, OgConfig } from "./ogLogic";

interface OgStore {
  config: OgConfig;
  activeTemplate: string;
  setTitle: (v: string) => void;
  setSubtitle: (v: string) => void;
  setBadge: (v: string) => void;
  setBgType: (v: BgType) => void;
  setBgColor: (v: string) => void;
  setBgColorEnd: (v: string) => void;
  setGradientAngle: (v: number) => void;
  setTextColor: (v: string) => void;
  setBadgeBg: (v: string) => void;
  setBadgeText: (v: string) => void;
  setLayout: (v: Layout) => void;
  setFont: (v: FontPreset) => void;
  setBgImage: (v: string | null) => void;
  setBgImageOpacity: (v: number) => void;
  setLogoImage: (v: string | null) => void;
  setLogoSize: (v: number) => void;
  setCanvasWidth: (v: number) => void;
  setCanvasHeight: (v: number) => void;
  canvasWidth: number;
  canvasHeight: number;
  applyTemplate: (key: string) => void;
}

export const useOgStore = create<OgStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      activeTemplate: "dark",
      canvasWidth: 1200,
      canvasHeight: 630,

      setTitle: (title) => set((s) => ({ config: { ...s.config, title } })),
      setSubtitle: (subtitle) => set((s) => ({ config: { ...s.config, subtitle } })),
      setBadge: (badge) => set((s) => ({ config: { ...s.config, badge } })),
      setBgType: (bgType) => set((s) => ({ config: { ...s.config, bgType } })),
      setBgColor: (bgColor) => set((s) => ({ config: { ...s.config, bgColor } })),
      setBgColorEnd: (bgColorEnd) => set((s) => ({ config: { ...s.config, bgColorEnd } })),
      setGradientAngle: (gradientAngle) => set((s) => ({ config: { ...s.config, gradientAngle } })),
      setTextColor: (textColor) => set((s) => ({ config: { ...s.config, textColor } })),
      setBadgeBg: (badgeBg) => set((s) => ({ config: { ...s.config, badgeBg } })),
      setBadgeText: (badgeText) => set((s) => ({ config: { ...s.config, badgeText } })),
      setLayout: (layout) => set((s) => ({ config: { ...s.config, layout } })),
      setFont: (font) => set((s) => ({ config: { ...s.config, font } })),
      setBgImage: (bgImage) => set((s) => ({ config: { ...s.config, bgImage } })),
      setBgImageOpacity: (bgImageOpacity) =>
        set((s) => ({ config: { ...s.config, bgImageOpacity } })),
      setLogoImage: (logoImage) => set((s) => ({ config: { ...s.config, logoImage } })),
      setLogoSize: (logoSize) => set((s) => ({ config: { ...s.config, logoSize } })),
      setCanvasWidth: (canvasWidth) => set({ canvasWidth }),
      setCanvasHeight: (canvasHeight) => set({ canvasHeight }),

      applyTemplate: (key) =>
        set((s) => {
          const patch = TEMPLATES[key];
          if (!patch) return s;
          return {
            config: applyTemplate(s.config, patch),
            activeTemplate: key,
          };
        }),
    }),
    {
      name: "og-tool-state",
      // Don't persist bgImage/logoImage (large data URLs; re-upload on reload)
      partialize: (s) => ({
        config: { ...s.config, bgImage: null, logoImage: null },
        activeTemplate: s.activeTemplate,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
      }),
    }
  )
);
