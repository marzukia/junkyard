import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BezierParams,
  BorderRadiusParams,
  BoxShadowParams,
  ConicGradientParams,
  GlassParams,
  GradientStop,
  LinearGradientParams,
  RadialGradientParams,
  TransformParams,
  TransitionParams,
} from "../lib/css";

export type Tab =
  | "shadow"
  | "linear"
  | "radial"
  | "conic"
  | "glass"
  | "bezier"
  | "radius"
  | "transform";

// ── Default values (exported so Reset can reference them) ─────────────────────

export const DEFAULT_SHADOW: BoxShadowParams = {
  offsetX: 4,
  offsetY: 8,
  blur: 24,
  spread: 0,
  color: "#000000",
  opacity: 0.2,
  inset: false,
};

export const DEFAULT_LINEAR: LinearGradientParams = {
  angle: 135,
  stops: [
    { id: "l0", color: "#2f9d8d", position: 0 },
    { id: "l1", color: "#e8b04b", position: 100 },
  ],
};

export const DEFAULT_RADIAL: RadialGradientParams = {
  shape: "circle",
  posX: 50,
  posY: 50,
  stops: [
    { id: "r0", color: "#e8b04b", position: 0 },
    { id: "r1", color: "#d9594c", position: 100 },
  ],
};

export const DEFAULT_GLASS: GlassParams = {
  blur: 12,
  saturation: 180,
  bgColor: "#ffffff",
  bgOpacity: 0.2,
  borderOpacity: 0.3,
  borderRadius: 16,
};

export const DEFAULT_BEZIER: BezierParams = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };

export const DEFAULT_BORDER_RADIUS: BorderRadiusParams = {
  linked: true,
  all: 16,
  topLeft: 16,
  topRight: 16,
  bottomRight: 16,
  bottomLeft: 16,
  unit: "px",
};

export const DEFAULT_CONIC: ConicGradientParams = {
  angle: 0,
  posX: 50,
  posY: 50,
  stops: [
    { id: "c0", color: "#2f9d8d", position: 0 },
    { id: "c1", color: "#e8b04b", position: 50 },
    { id: "c2", color: "#d9594c", position: 100 },
  ],
};

export const DEFAULT_TRANSFORM: TransformParams = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  skewX: 0,
  skewY: 0,
};

export const DEFAULT_TRANSITION: TransitionParams = {
  property: "all",
  duration: 300,
  delay: 0,
  easing: "cubic-bezier(0.42, 0, 0.58, 1)",
};

// ── Store interface ───────────────────────────────────────────────────────────

interface CssState {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;

  // Box shadow
  shadow: BoxShadowParams;
  setShadow: (patch: Partial<BoxShadowParams>) => void;
  resetShadow: () => void;

  // Linear gradient
  linear: LinearGradientParams;
  setLinearAngle: (angle: number) => void;
  setLinearStop: (idx: number, patch: Partial<GradientStop>) => void;
  addLinearStop: () => void;
  removeLinearStop: (idx: number) => void;
  resetLinear: () => void;

  // Radial gradient
  radial: RadialGradientParams;
  setRadialField: (patch: Partial<Omit<RadialGradientParams, "stops">>) => void;
  setRadialStop: (idx: number, patch: Partial<GradientStop>) => void;
  addRadialStop: () => void;
  removeRadialStop: (idx: number) => void;
  resetRadial: () => void;

  // Glassmorphism
  glass: GlassParams;
  setGlass: (patch: Partial<GlassParams>) => void;
  resetGlass: () => void;

  // Cubic bezier
  bezier: BezierParams;
  setBezier: (patch: Partial<BezierParams>) => void;
  resetBezier: () => void;

  // Border radius
  borderRadius: BorderRadiusParams;
  setBorderRadius: (patch: Partial<BorderRadiusParams>) => void;
  resetBorderRadius: () => void;

  // Conic gradient
  conic: ConicGradientParams;
  setConicField: (patch: Partial<Omit<ConicGradientParams, "stops">>) => void;
  setConicStop: (idx: number, patch: Partial<GradientStop>) => void;
  addConicStop: () => void;
  removeConicStop: (idx: number) => void;
  resetConic: () => void;

  // Transform + transition
  transform: TransformParams;
  setTransform: (patch: Partial<TransformParams>) => void;
  resetTransform: () => void;
  transition: TransitionParams;
  setTransition: (patch: Partial<TransitionParams>) => void;
  resetTransition: () => void;
}

export const useCssStore = create<CssState>()(
  persist(
    (set) => ({
      activeTab: "shadow",
      setActiveTab: (tab) => set({ activeTab: tab }),

      // ── Box shadow ──────────────────────────────────────────────────────────
      shadow: DEFAULT_SHADOW,
      setShadow: (patch) =>
        set((s) => ({
          shadow: { ...s.shadow, ...patch },
        })),
      resetShadow: () => set({ shadow: DEFAULT_SHADOW }),

      // ── Linear gradient ─────────────────────────────────────────────────────
      linear: DEFAULT_LINEAR,
      setLinearAngle: (angle) =>
        set((s) => ({
          linear: { ...s.linear, angle },
        })),
      setLinearStop: (idx, patch) =>
        set((s) => {
          const stops = s.linear.stops.map((st, i) => (i === idx ? { ...st, ...patch } : st));
          return { linear: { ...s.linear, stops } };
        }),
      addLinearStop: () =>
        set((s) => {
          const id = `l${Date.now()}`;
          const stops = [...s.linear.stops, { id, color: "#d9594c", position: 50 }];
          return { linear: { ...s.linear, stops } };
        }),
      removeLinearStop: (idx) =>
        set((s) => {
          if (s.linear.stops.length <= 2) return s;
          const stops = s.linear.stops.filter((_, i) => i !== idx);
          return { linear: { ...s.linear, stops } };
        }),
      resetLinear: () => set({ linear: DEFAULT_LINEAR }),

      // ── Radial gradient ─────────────────────────────────────────────────────
      radial: DEFAULT_RADIAL,
      setRadialField: (patch) =>
        set((s) => ({
          radial: { ...s.radial, ...patch },
        })),
      setRadialStop: (idx, patch) =>
        set((s) => {
          const stops = s.radial.stops.map((st, i) => (i === idx ? { ...st, ...patch } : st));
          return { radial: { ...s.radial, stops } };
        }),
      addRadialStop: () =>
        set((s) => {
          const id = `r${Date.now()}`;
          const stops = [...s.radial.stops, { id, color: "#2f9d8d", position: 50 }];
          return { radial: { ...s.radial, stops } };
        }),
      removeRadialStop: (idx) =>
        set((s) => {
          if (s.radial.stops.length <= 2) return s;
          const stops = s.radial.stops.filter((_, i) => i !== idx);
          return { radial: { ...s.radial, stops } };
        }),
      resetRadial: () => set({ radial: DEFAULT_RADIAL }),

      // ── Glassmorphism ───────────────────────────────────────────────────────
      glass: DEFAULT_GLASS,
      setGlass: (patch) =>
        set((s) => ({
          glass: { ...s.glass, ...patch },
        })),
      resetGlass: () => set({ glass: DEFAULT_GLASS }),

      // ── Cubic bezier ────────────────────────────────────────────────────────
      bezier: DEFAULT_BEZIER,
      setBezier: (patch) =>
        set((s) => ({
          bezier: { ...s.bezier, ...patch },
        })),
      resetBezier: () => set({ bezier: DEFAULT_BEZIER }),

      // ── Border radius ────────────────────────────────────────────────────────
      borderRadius: DEFAULT_BORDER_RADIUS,
      setBorderRadius: (patch) =>
        set((s) => ({
          borderRadius: { ...s.borderRadius, ...patch },
        })),
      resetBorderRadius: () => set({ borderRadius: DEFAULT_BORDER_RADIUS }),

      // ── Conic gradient ───────────────────────────────────────────────────────
      conic: DEFAULT_CONIC,
      setConicField: (patch) =>
        set((s) => ({
          conic: { ...s.conic, ...patch },
        })),
      setConicStop: (idx, patch) =>
        set((s) => {
          const stops = s.conic.stops.map((st, i) => (i === idx ? { ...st, ...patch } : st));
          return { conic: { ...s.conic, stops } };
        }),
      addConicStop: () =>
        set((s) => {
          const id = `c${Date.now()}`;
          const stops = [...s.conic.stops, { id, color: "#2f9d8d", position: 75 }];
          return { conic: { ...s.conic, stops } };
        }),
      removeConicStop: (idx) =>
        set((s) => {
          if (s.conic.stops.length <= 2) return s;
          const stops = s.conic.stops.filter((_, i) => i !== idx);
          return { conic: { ...s.conic, stops } };
        }),
      resetConic: () => set({ conic: DEFAULT_CONIC }),

      // ── Transform + transition ───────────────────────────────────────────────
      transform: DEFAULT_TRANSFORM,
      setTransform: (patch) =>
        set((s) => ({
          transform: { ...s.transform, ...patch },
        })),
      resetTransform: () => set({ transform: DEFAULT_TRANSFORM }),
      transition: DEFAULT_TRANSITION,
      setTransition: (patch) =>
        set((s) => ({
          transition: { ...s.transition, ...patch },
        })),
      resetTransition: () => set({ transition: DEFAULT_TRANSITION }),
    }),
    {
      name: "css-tool-state",
      // Only persist the data, not the action functions
      partialize: (s) => ({
        activeTab: s.activeTab,
        shadow: s.shadow,
        linear: s.linear,
        radial: s.radial,
        glass: s.glass,
        bezier: s.bezier,
        borderRadius: s.borderRadius,
        conic: s.conic,
        transform: s.transform,
        transition: s.transition,
      }),
    }
  )
);
