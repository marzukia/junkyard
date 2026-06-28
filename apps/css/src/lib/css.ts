1|// ── Box Shadow ────────────────────────────────────────────────────────────────
import { clamp } from "@junkyardsh/ui";
2|
3|export interface BoxShadowParams {
4|  offsetX: number;
5|  offsetY: number;
6|  blur: number;
7|  spread: number;
8|  color: string;
9|  opacity: number;
10|  inset: boolean;
11|}
12|
13|export function buildBoxShadow(p: BoxShadowParams): string {
14|  const rgba = hexToRgba(p.color, p.opacity);
15|  const insetPart = p.inset ? "inset " : "";
16|  return `${insetPart}${p.offsetX}px ${p.offsetY}px ${p.blur}px ${p.spread}px ${rgba}`;
17|}
18|
19|export function buildBoxShadowRule(p: BoxShadowParams): string {
20|  return `box-shadow: ${buildBoxShadow(p)};`;
21|}
22|
23|// ── Linear Gradient ───────────────────────────────────────────────────────────
24|
25|export interface GradientStop {
26|  id: string;
27|  color: string;
28|  position: number;
29|}
30|
31|export interface LinearGradientParams {
32|  angle: number;
33|  stops: GradientStop[];
34|}
35|
36|export function buildLinearGradient(p: LinearGradientParams): string {
37|  if (p.stops.length === 0) return "none";
38|  const stopStr = p.stops
39|    .slice()
40|    .sort((a, b) => a.position - b.position)
41|    .map((s) => `${s.color} ${s.position}%`)
42|    .join(", ");
43|  return `linear-gradient(${p.angle}deg, ${stopStr})`;
44|}
45|
46|export function buildLinearGradientRule(p: LinearGradientParams): string {
47|  return `background: ${buildLinearGradient(p)};`;
48|}
49|
50|// ── Radial Gradient ───────────────────────────────────────────────────────────
51|
52|export type RadialShape = "circle" | "ellipse";
53|
54|export interface RadialGradientParams {
55|  shape: RadialShape;
56|  stops: GradientStop[];
57|  posX: number;
58|  posY: number;
59|}
60|
61|export function buildRadialGradient(p: RadialGradientParams): string {
62|  if (p.stops.length === 0) return "none";
63|  const stopStr = p.stops
64|    .slice()
65|    .sort((a, b) => a.position - b.position)
66|    .map((s) => `${s.color} ${s.position}%`)
67|    .join(", ");
68|  return `radial-gradient(${p.shape} at ${p.posX}% ${p.posY}%, ${stopStr})`;
69|}
70|
71|export function buildRadialGradientRule(p: RadialGradientParams): string {
72|  return `background: ${buildRadialGradient(p)};`;
73|}
74|
75|// ── Glassmorphism ─────────────────────────────────────────────────────────────
76|
77|export interface GlassParams {
78|  blur: number;
79|  saturation: number;
80|  bgColor: string;
81|  bgOpacity: number;
82|  borderOpacity: number;
83|  borderRadius: number;
84|}
85|
86|export function buildGlassCss(p: GlassParams): string {
87|  const bg = hexToRgba(p.bgColor, p.bgOpacity);
88|  const border = hexToRgba(p.bgColor, p.borderOpacity);
89|  const filter = `blur(${p.blur}px) saturate(${p.saturation}%)`;
90|  return [
91|    `background: ${bg};`,
92|    `backdrop-filter: ${filter};`,
93|    `-webkit-backdrop-filter: ${filter};`,
94|    `border: 1px solid ${border};`,
95|    `border-radius: ${p.borderRadius}px;`,
96|  ].join("\n");
97|}
98|
99|// ── Cubic Bezier ──────────────────────────────────────────────────────────────
100|
101|export interface BezierParams {
102|  x1: number;
103|  y1: number;
104|  x2: number;
105|  y2: number;
106|}
107|
108|export function buildBezierRule(p: BezierParams): string {
109|  const fmt = (n: number) => Math.round(n * 1000) / 1000;
110|  return `transition-timing-function: cubic-bezier(${fmt(p.x1)}, ${fmt(p.y1)}, ${fmt(p.x2)}, ${fmt(p.y2)});`;
111|}
112|
113|export function buildBezierValue(p: BezierParams): string {
114|  const fmt = (n: number) => Math.round(n * 1000) / 1000;
115|  return `cubic-bezier(${fmt(p.x1)}, ${fmt(p.y1)}, ${fmt(p.x2)}, ${fmt(p.y2)})`;
116|}
117|
118|// ── Colour helpers ────────────────────────────────────────────────────────────
119|
120|/**
121| * Convert a #rrggbb hex colour + opacity (0-1) to an rgba(...) string.
122| * Handles both 3-digit and 6-digit hex.
123| */
124|export function hexToRgba(hex: string, opacity: number): string {
125|  const clean = hex.replace(/^#/, "");
126|  let r: number;
127|  let g: number;
128|  let b: number;
129|
130|  if (clean.length === 3) {
131|    r = Number.parseInt(clean[0] + clean[0], 16);
132|    g = Number.parseInt(clean[1] + clean[1], 16);
133|    b = Number.parseInt(clean[2] + clean[2], 16);
134|  } else {
135|    r = Number.parseInt(clean.slice(0, 2), 16);
136|    g = Number.parseInt(clean.slice(2, 4), 16);
137|    b = Number.parseInt(clean.slice(4, 6), 16);
138|  }
139|
140|  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
141|    throw new Error(`Invalid hex colour: "${hex}"`);
142|  }
143|
144|  const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 100) / 100;
145|  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
146|}
147|
148|/**
149| * Validate a CSS hex colour string. Returns true for #rgb and #rrggbb.
150| */
151|export function isValidHex(hex: string): boolean {
152|  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
153|}
154|
155|/**
156| * Clamp a value between min and max (inclusive).
157| */
158|export function clamp(value: number, min: number, max: number): number {
159|  return Math.min(Math.max(value, min), max);
160|}
161|
162|// ── Border Radius ─────────────────────────────────────────────────────────────
163|
164|export interface BorderRadiusParams {
165|  /** true = all corners use the `all` value; false = independent corners */
166|  linked: boolean;
167|  all: number;
168|  topLeft: number;
169|  topRight: number;
170|  bottomRight: number;
171|  bottomLeft: number;
172|  unit: "px" | "%";
173|}
174|
175|/** Build the shorthand border-radius value string. */
176|export function buildBorderRadiusValue(p: BorderRadiusParams): string {
177|  const u = p.unit;
178|  if (p.linked) return `${p.all}${u}`;
179|  const tl = p.topLeft;
180|  const tr = p.topRight;
181|  const br = p.bottomRight;
182|  const bl = p.bottomLeft;
183|  // Use shorthand when symmetric
184|  if (tl === tr && tr === br && br === bl) return `${tl}${u}`;
185|  if (tl === br && tr === bl) return `${tl}${u} ${tr}${u}`;
186|  if (tr === bl) return `${tl}${u} ${tr}${u} ${br}${u}`;
187|  return `${tl}${u} ${tr}${u} ${br}${u} ${bl}${u}`;
188|}
189|
190|export function buildBorderRadiusRule(p: BorderRadiusParams): string {
191|  return `border-radius: ${buildBorderRadiusValue(p)};`;
192|}
193|
194|// ── Conic Gradient ────────────────────────────────────────────────────────────
195|
196|export interface ConicGradientParams {
197|  angle: number;
198|  posX: number;
199|  posY: number;
200|  stops: GradientStop[];
201|}
202|
203|export function buildConicGradient(p: ConicGradientParams): string {
204|  if (p.stops.length === 0) return "none";
205|  const stopStr = p.stops
206|    .slice()
207|    .sort((a, b) => a.position - b.position)
208|    .map((s) => `${s.color} ${s.position}%`)
209|    .join(", ");
210|  return `conic-gradient(from ${p.angle}deg at ${p.posX}% ${p.posY}%, ${stopStr})`;
211|}
212|
213|export function buildConicGradientRule(p: ConicGradientParams): string {
214|  return `background: ${buildConicGradient(p)};`;
215|}
216|
217|// ── Transform ─────────────────────────────────────────────────────────────────
218|
219|export interface TransformParams {
220|  translateX: number;
221|  translateY: number;
222|  scaleX: number;
223|  scaleY: number;
224|  rotate: number;
225|  skewX: number;
226|  skewY: number;
227|}
228|
229|/** Build a CSS transform value from individual params. Omits no-op components. */
230|export function buildTransformValue(p: TransformParams): string {
231|  const parts: string[] = [];
232|  if (p.translateX !== 0 || p.translateY !== 0) {
233|    parts.push(`translate(${p.translateX}px, ${p.translateY}px)`);
234|  }
235|  if (p.rotate !== 0) parts.push(`rotate(${p.rotate}deg)`);
236|  if (p.scaleX !== 1 || p.scaleY !== 1) {
237|    parts.push(p.scaleX === p.scaleY ? `scale(${p.scaleX})` : `scale(${p.scaleX}, ${p.scaleY})`);
238|  }
239|  if (p.skewX !== 0 || p.skewY !== 0) {
240|    parts.push(`skew(${p.skewX}deg, ${p.skewY}deg)`);
241|  }
242|  return parts.length > 0 ? parts.join(" ") : "none";
243|}
244|
245|// ── Transition ────────────────────────────────────────────────────────────────
246|
247|export type TransitionProperty =
248|  | "all"
249|  | "opacity"
250|  | "transform"
251|  | "background"
252|  | "color"
253|  | "border"
254|  | "box-shadow"
255|  | "width"
256|  | "height"
257|  | "top"
258|  | "left";
259|
260|export interface TransitionParams {
261|  property: TransitionProperty;
262|  duration: number; // ms
263|  delay: number; // ms
264|  easing: string; // cubic-bezier(...) or keyword
265|}
266|
267|export function buildTransitionRule(
268|  transform: TransformParams,
269|  transition: TransitionParams
270|): string {
271|  const transformVal = buildTransformValue(transform);
272|  const durationSec = (transition.duration / 1000).toFixed(2).replace(/\.?0+$/, "");
273|  const delaySec = (transition.delay / 1000).toFixed(2).replace(/\.?0+$/, "");
274|  const delayPart = transition.delay > 0 ? ` ${delaySec}s` : "";
275|  return [
276|    `transform: ${transformVal};`,
277|    `transition: ${transition.property} ${durationSec}s ${transition.easing}${delayPart};`,
278|  ].join("\n");
279|}
280|