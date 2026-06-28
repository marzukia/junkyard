// ── Box Shadow ────────────────────────────────────────────────────────────────

export interface BoxShadowParams {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}

export function buildBoxShadow(p: BoxShadowParams): string {
  const rgba = hexToRgba(p.color, p.opacity);
  const insetPart = p.inset ? "inset " : "";
  return `${insetPart}${p.offsetX}px ${p.offsetY}px ${p.blur}px ${p.spread}px ${rgba}`;
}

export function buildBoxShadowRule(p: BoxShadowParams): string {
  return `box-shadow: ${buildBoxShadow(p)};`;
}

// ── Linear Gradient ───────────────────────────────────────────────────────────

export interface GradientStop {
  id: string;
  color: string;
  position: number;
}

export interface LinearGradientParams {
  angle: number;
  stops: GradientStop[];
}

export function buildLinearGradient(p: LinearGradientParams): string {
  if (p.stops.length === 0) return "none";
  const stopStr = p.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  return `linear-gradient(${p.angle}deg, ${stopStr})`;
}

export function buildLinearGradientRule(p: LinearGradientParams): string {
  return `background: ${buildLinearGradient(p)};`;
}

// ── Radial Gradient ───────────────────────────────────────────────────────────

export type RadialShape = "circle" | "ellipse";

export interface RadialGradientParams {
  shape: RadialShape;
  stops: GradientStop[];
  posX: number;
  posY: number;
}

export function buildRadialGradient(p: RadialGradientParams): string {
  if (p.stops.length === 0) return "none";
  const stopStr = p.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  return `radial-gradient(${p.shape} at ${p.posX}% ${p.posY}%, ${stopStr})`;
}

export function buildRadialGradientRule(p: RadialGradientParams): string {
  return `background: ${buildRadialGradient(p)};`;
}

// ── Glassmorphism ─────────────────────────────────────────────────────────────

export interface GlassParams {
  blur: number;
  saturation: number;
  bgColor: string;
  bgOpacity: number;
  borderOpacity: number;
  borderRadius: number;
}

export function buildGlassCss(p: GlassParams): string {
  const bg = hexToRgba(p.bgColor, p.bgOpacity);
  const border = hexToRgba(p.bgColor, p.borderOpacity);
  const filter = `blur(${p.blur}px) saturate(${p.saturation}%)`;
  return [
    `background: ${bg};`,
    `backdrop-filter: ${filter};`,
    `-webkit-backdrop-filter: ${filter};`,
    `border: 1px solid ${border};`,
    `border-radius: ${p.borderRadius}px;`,
  ].join("\n");
}

// ── Cubic Bezier ──────────────────────────────────────────────────────────────

export interface BezierParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function buildBezierRule(p: BezierParams): string {
  const fmt = (n: number) => Math.round(n * 1000) / 1000;
  return `transition-timing-function: cubic-bezier(${fmt(p.x1)}, ${fmt(p.y1)}, ${fmt(p.x2)}, ${fmt(p.y2)});`;
}

export function buildBezierValue(p: BezierParams): string {
  const fmt = (n: number) => Math.round(n * 1000) / 1000;
  return `cubic-bezier(${fmt(p.x1)}, ${fmt(p.y1)}, ${fmt(p.x2)}, ${fmt(p.y2)})`;
}

// ── Colour helpers ────────────────────────────────────────────────────────────

/**
 * Convert a #rrggbb hex colour + opacity (0-1) to an rgba(...) string.
 * Handles both 3-digit and 6-digit hex.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace(/^#/, "");
  let r: number;
  let g: number;
  let b: number;

  if (clean.length === 3) {
    r = Number.parseInt(clean[0] + clean[0], 16);
    g = Number.parseInt(clean[1] + clean[1], 16);
    b = Number.parseInt(clean[2] + clean[2], 16);
  } else {
    r = Number.parseInt(clean.slice(0, 2), 16);
    g = Number.parseInt(clean.slice(2, 4), 16);
    b = Number.parseInt(clean.slice(4, 6), 16);
  }

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    throw new Error(`Invalid hex colour: "${hex}"`);
  }

  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Validate a CSS hex colour string. Returns true for #rgb and #rrggbb.
 */
export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

export { clamp } from "@junkyardsh/ui";

// ── Border Radius ─────────────────────────────────────────────────────────────

export interface BorderRadiusParams {
  /** true = all corners use the `all` value; false = independent corners */
  linked: boolean;
  all: number;
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
  unit: "px" | "%";
}

/** Build the shorthand border-radius value string. */
export function buildBorderRadiusValue(p: BorderRadiusParams): string {
  const u = p.unit;
  if (p.linked) return `${p.all}${u}`;
  const tl = p.topLeft;
  const tr = p.topRight;
  const br = p.bottomRight;
  const bl = p.bottomLeft;
  // Use shorthand when symmetric
  if (tl === tr && tr === br && br === bl) return `${tl}${u}`;
  if (tl === br && tr === bl) return `${tl}${u} ${tr}${u}`;
  if (tr === bl) return `${tl}${u} ${tr}${u} ${br}${u}`;
  return `${tl}${u} ${tr}${u} ${br}${u} ${bl}${u}`;
}

export function buildBorderRadiusRule(p: BorderRadiusParams): string {
  return `border-radius: ${buildBorderRadiusValue(p)};`;
}

// ── Conic Gradient ────────────────────────────────────────────────────────────

export interface ConicGradientParams {
  angle: number;
  posX: number;
  posY: number;
  stops: GradientStop[];
}

export function buildConicGradient(p: ConicGradientParams): string {
  if (p.stops.length === 0) return "none";
  const stopStr = p.stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ");
  return `conic-gradient(from ${p.angle}deg at ${p.posX}% ${p.posY}%, ${stopStr})`;
}

export function buildConicGradientRule(p: ConicGradientParams): string {
  return `background: ${buildConicGradient(p)};`;
}

// ── Transform ─────────────────────────────────────────────────────────────────

export interface TransformParams {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  skewX: number;
  skewY: number;
}

/** Build a CSS transform value from individual params. Omits no-op components. */
export function buildTransformValue(p: TransformParams): string {
  const parts: string[] = [];
  if (p.translateX !== 0 || p.translateY !== 0) {
    parts.push(`translate(${p.translateX}px, ${p.translateY}px)`);
  }
  if (p.rotate !== 0) parts.push(`rotate(${p.rotate}deg)`);
  if (p.scaleX !== 1 || p.scaleY !== 1) {
    parts.push(p.scaleX === p.scaleY ? `scale(${p.scaleX})` : `scale(${p.scaleX}, ${p.scaleY})`);
  }
  if (p.skewX !== 0 || p.skewY !== 0) {
    parts.push(`skew(${p.skewX}deg, ${p.skewY}deg)`);
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ── Transition ────────────────────────────────────────────────────────────────

export type TransitionProperty =
  | "all"
  | "opacity"
  | "transform"
  | "background"
  | "color"
  | "border"
  | "box-shadow"
  | "width"
  | "height"
  | "top"
  | "left";

export interface TransitionParams {
  property: TransitionProperty;
  duration: number; // ms
  delay: number; // ms
  easing: string; // cubic-bezier(...) or keyword
}

export function buildTransitionRule(
  transform: TransformParams,
  transition: TransitionParams
): string {
  const transformVal = buildTransformValue(transform);
  const durationSec = (transition.duration / 1000).toFixed(2).replace(/\.?0+$/, "");
  const delaySec = (transition.delay / 1000).toFixed(2).replace(/\.?0+$/, "");
  const delayPart = transition.delay > 0 ? ` ${delaySec}s` : "";
  return [
    `transform: ${transformVal};`,
    `transition: ${transition.property} ${durationSec}s ${transition.easing}${delayPart};`,
  ].join("\n");
}
