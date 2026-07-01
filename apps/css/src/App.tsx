import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildBezierRule,
  buildBezierValue,
  buildBorderRadiusRule,
  buildBorderRadiusValue,
  buildBoxShadow,
  buildBoxShadowRule,
  buildConicGradient,
  buildConicGradientRule,
  buildGlassCss,
  buildLinearGradient,
  buildLinearGradientRule,
  buildRadialGradient,
  buildRadialGradientRule,
  buildTransformValue,
  buildTransitionRule,
  clamp,
  isValidHex,
} from "./lib/css";
import type {
  BorderRadiusParams,
  BoxShadowParams,
  ConicGradientParams,
  GradientStop,
  LinearGradientParams,
  RadialGradientParams,
  TransitionProperty,
} from "./lib/css";
import { useCssStore } from "./store/cssStore";
import type { Tab } from "./store/cssStore";

// ── CSS brand glyph: bracket pair with center dot ─────────────────────────────

function CssBrandGlyph() {
  return (
    <>
      <path
        d="M10 5 L7 5 Q4 5 4 8 L4 13 Q4 16 7 16 Q4 16 4 19 L4 24 Q4 27 7 27 L10 27"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 5 L25 5 Q28 5 28 8 L28 13 Q28 16 25 16 Q28 16 28 19 L28 24 Q28 27 25 27 L22 27"
        stroke="#d9594c"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.5" fill="#e8b04b" />
      <circle cx="16" cy="10" r="1.2" fill="#2f9d8d" opacity="0.6" />
      <circle cx="16" cy="22" r="1.2" fill="#2f9d8d" opacity="0.6" />
    </>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { value: Tab; label: string }[] = [
  { value: "shadow", label: "Box Shadow" },
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
  { value: "conic", label: "Conic" },
  { value: "glass", label: "Glassmorphism" },
  { value: "bezier", label: "Cubic Bezier" },
  { value: "radius", label: "Border Radius" },
  { value: "transform", label: "Transform" },
];

// ── Shadow presets ────────────────────────────────────────────────────────────

interface ShadowPreset {
  label: string;
  params: BoxShadowParams;
}

const SHADOW_PRESETS: ShadowPreset[] = [
  {
    label: "Soft",
    params: {
      offsetX: 0,
      offsetY: 8,
      blur: 32,
      spread: -4,
      color: "#000000",
      opacity: 0.15,
      inset: false,
    },
  },
  {
    label: "Hard",
    params: {
      offsetX: 4,
      offsetY: 4,
      blur: 0,
      spread: 0,
      color: "#000000",
      opacity: 0.85,
      inset: false,
    },
  },
  {
    label: "Lifted",
    params: {
      offsetX: 0,
      offsetY: 20,
      blur: 60,
      spread: -12,
      color: "#000000",
      opacity: 0.25,
      inset: false,
    },
  },
  {
    label: "Inset",
    params: {
      offsetX: 0,
      offsetY: 2,
      blur: 8,
      spread: 0,
      color: "#000000",
      opacity: 0.2,
      inset: true,
    },
  },
  {
    label: "Coloured",
    params: {
      offsetX: 0,
      offsetY: 8,
      blur: 24,
      spread: -4,
      color: "#2f9d8d",
      opacity: 0.5,
      inset: false,
    },
  },
];

// ── Linear gradient presets ───────────────────────────────────────────────────

interface LinearPreset {
  label: string;
  params: LinearGradientParams;
}

const LINEAR_PRESETS: LinearPreset[] = [
  {
    label: "Teal to Gold",
    params: {
      angle: 135,
      stops: [
        { id: "p0", color: "#2f9d8d", position: 0 },
        { id: "p1", color: "#e8b04b", position: 100 },
      ],
    },
  },
  {
    label: "Sunset",
    params: {
      angle: 90,
      stops: [
        { id: "p0", color: "#f7971e", position: 0 },
        { id: "p1", color: "#d9594c", position: 100 },
      ],
    },
  },
  {
    label: "Night",
    params: {
      angle: 160,
      stops: [
        { id: "p0", color: "#1a2530", position: 0 },
        { id: "p1", color: "#2f4f6f", position: 100 },
      ],
    },
  },
  {
    label: "Tri-colour",
    params: {
      angle: 135,
      stops: [
        { id: "p0", color: "#d9594c", position: 0 },
        { id: "p1", color: "#e8b04b", position: 50 },
        { id: "p2", color: "#2f9d8d", position: 100 },
      ],
    },
  },
];

// ── Radial gradient presets ───────────────────────────────────────────────────

interface RadialPreset {
  label: string;
  params: RadialGradientParams;
}

const RADIAL_PRESETS: RadialPreset[] = [
  {
    label: "Warm Burst",
    params: {
      shape: "circle",
      posX: 50,
      posY: 50,
      stops: [
        { id: "p0", color: "#e8b04b", position: 0 },
        { id: "p1", color: "#d9594c", position: 100 },
      ],
    },
  },
  {
    label: "Cool Spot",
    params: {
      shape: "circle",
      posX: 30,
      posY: 30,
      stops: [
        { id: "p0", color: "#ffffff", position: 0 },
        { id: "p1", color: "#2f9d8d", position: 100 },
      ],
    },
  },
  {
    label: "Vignette",
    params: {
      shape: "ellipse",
      posX: 50,
      posY: 50,
      stops: [
        { id: "p0", color: "#ffffff", position: 0 },
        { id: "p1", color: "#000000", position: 100 },
      ],
    },
  },
];

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => {
        setState("copied");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 1800);
      },
      () => {
        setState("error");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2500);
      }
    );
  }, [text]);

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={handleCopy}
      aria-label="Copy CSS to clipboard"
      disabled={!text}
    >
      {state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : "Copy CSS"}
    </button>
  );
}

// ── Reset button ──────────────────────────────────────────────────────────────

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={onReset}
      aria-label="Reset to defaults"
    >
      Reset
    </button>
  );
}

// ── Colour input: swatch + hex text ──────────────────────────────────────────

interface ColorFieldProps {
  value: string;
  onChange: (hex: string) => void;
  id?: string;
}

function ColorField({ value, onChange, id }: ColorFieldProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = useCallback(
    (raw: string) => {
      if (isValidHex(raw)) onChange(raw);
      else setDraft(value);
    },
    [onChange, value]
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <input
        type="color"
        className="css-color-input"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        aria-label="Pick colour"
      />
      <input
        id={id}
        type="text"
        className="css-hex-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commitDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitDraft((e.target as HTMLInputElement).value);
        }}
        aria-label="Hex colour value"
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}

// ── Gradient stop list ────────────────────────────────────────────────────────

interface GradientStopsProps {
  stops: GradientStop[];
  onStopChange: (idx: number, patch: Partial<GradientStop>) => void;
  onAddStop: () => void;
  onRemoveStop: (idx: number) => void;
}

function GradientStops({ stops, onStopChange, onAddStop, onRemoveStop }: GradientStopsProps) {
  return (
    <div className="gradient-stops">
      {stops.map((stop, idx) => (
        <div key={stop.id} className="gradient-stop-row">
          <ColorField value={stop.color} onChange={(hex) => onStopChange(idx, { color: hex })} />
          <input
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={stop.position}
            onChange={(e) => onStopChange(idx, { position: Number(e.target.value) })}
            aria-label={`Stop ${idx + 1} position`}
          />
          <span className="css-val">{stop.position}%</span>
          {stops.length > 2 && (
            <button
              type="button"
              className="gradient-stop-remove"
              onClick={() => onRemoveStop(idx)}
              aria-label={`Remove stop ${idx + 1}`}
            >
              x
            </button>
          )}
        </div>
      ))}
      <button type="button" className="add-stop-btn" onClick={onAddStop}>
        + Add stop
      </button>
    </div>
  );
}

// ── Box Shadow tab ────────────────────────────────────────────────────────────

function BoxShadowTab() {
  const { shadow, setShadow, resetShadow } = useCssStore();
  const css = buildBoxShadowRule(shadow);

  const activePreset = SHADOW_PRESETS.find(
    (p) =>
      p.params.offsetX === shadow.offsetX &&
      p.params.offsetY === shadow.offsetY &&
      p.params.blur === shadow.blur &&
      p.params.spread === shadow.spread &&
      p.params.color === shadow.color &&
      Math.abs(p.params.opacity - shadow.opacity) < 0.01 &&
      p.params.inset === shadow.inset
  );

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Presets</span>
          <ResetButton onReset={resetShadow} />
        </div>

        <div className="css-presets-row">
          {SHADOW_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={`bezier-preset-btn${activePreset?.label === preset.label ? " bezier-preset-btn--active" : ""}`}
              onClick={() => setShadow(preset.params)}
              aria-pressed={activePreset?.label === preset.label}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-offset-x">
            Offset X
          </label>
          <input
            id="shadow-offset-x"
            type="range"
            className="css-range"
            min={-80}
            max={80}
            value={shadow.offsetX}
            onChange={(e) => setShadow({ offsetX: Number(e.target.value) })}
            aria-valuenow={shadow.offsetX}
          />
          <span className="css-val">{shadow.offsetX}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-offset-y">
            Offset Y
          </label>
          <input
            id="shadow-offset-y"
            type="range"
            className="css-range"
            min={-80}
            max={80}
            value={shadow.offsetY}
            onChange={(e) => setShadow({ offsetY: Number(e.target.value) })}
          />
          <span className="css-val">{shadow.offsetY}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-blur">
            Blur
          </label>
          <input
            id="shadow-blur"
            type="range"
            className="css-range"
            min={0}
            max={120}
            value={shadow.blur}
            onChange={(e) => setShadow({ blur: Number(e.target.value) })}
          />
          <span className="css-val">{shadow.blur}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-spread">
            Spread
          </label>
          <input
            id="shadow-spread"
            type="range"
            className="css-range"
            min={-40}
            max={80}
            value={shadow.spread}
            onChange={(e) => setShadow({ spread: Number(e.target.value) })}
          />
          <span className="css-val">{shadow.spread}px</span>
        </div>

        <div className="css-control-row">
          <span className="css-control-label">Colour</span>
          <ColorField value={shadow.color} onChange={(hex) => setShadow({ color: hex })} />
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-opacity">
            Opacity
          </label>
          <input
            id="shadow-opacity"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={Math.round(shadow.opacity * 100)}
            onChange={(e) => setShadow({ opacity: Number(e.target.value) / 100 })}
          />
          <span className="css-val">{Math.round(shadow.opacity * 100)}%</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="shadow-inset">
            Inset
          </label>
          <input
            id="shadow-inset"
            type="checkbox"
            checked={shadow.inset}
            onChange={(e) => setShadow({ inset: e.target.checked })}
            aria-label="Inset shadow"
          />
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div
          className="css-preview-box"
          style={{ background: "var(--canvas)", minHeight: 240 }}
          aria-hidden="true"
        >
          <div
            className="shadow-preview-inner"
            style={{
              boxShadow: buildBoxShadow(shadow),
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Linear Gradient tab ───────────────────────────────────────────────────────

function LinearGradientTab() {
  const { linear, setLinearAngle, setLinearStop, addLinearStop, removeLinearStop, resetLinear } =
    useCssStore();
  const gradientValue = buildLinearGradient(linear);
  const css = buildLinearGradientRule(linear);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Presets</span>
          <ResetButton onReset={resetLinear} />
        </div>

        <div className="css-presets-row">
          {LINEAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="bezier-preset-btn"
              onClick={() => {
                setLinearAngle(preset.params.angle);
                // Replace stops by calling setLinearAngle + a fresh state via resetLinear then applying
                // We use a direct store set approach via a quick apply
                useCssStore.setState({ linear: preset.params });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="linear-angle">
            Angle
          </label>
          <input
            id="linear-angle"
            type="range"
            className="css-range"
            min={0}
            max={360}
            value={linear.angle}
            onChange={(e) => setLinearAngle(Number(e.target.value))}
          />
          <span className="css-val">{linear.angle}deg</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span className="css-control-label">Colour Stops</span>
          <GradientStops
            stops={linear.stops}
            onStopChange={setLinearStop}
            onAddStop={addLinearStop}
            onRemoveStop={removeLinearStop}
          />
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div
          className="css-preview-box css-preview-checkerboard"
          style={{ minHeight: 240 }}
          aria-hidden="true"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 240,
              background: gradientValue,
              borderRadius: "var(--radius)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Radial Gradient tab ───────────────────────────────────────────────────────

function RadialGradientTab() {
  const { radial, setRadialField, setRadialStop, addRadialStop, removeRadialStop, resetRadial } =
    useCssStore();
  const gradientValue = buildRadialGradient(radial);
  const css = buildRadialGradientRule(radial);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Presets</span>
          <ResetButton onReset={resetRadial} />
        </div>

        <div className="css-presets-row">
          {RADIAL_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="bezier-preset-btn"
              onClick={() => useCssStore.setState({ radial: preset.params })}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="css-control-row">
          <span className="css-control-label">Shape</span>
          <div className="space-toggle" role="group" aria-label="Gradient shape">
            {(["circle", "ellipse"] as const).map((shape) => (
              <button
                key={shape}
                type="button"
                className={`space-btn${radial.shape === shape ? " space-btn--active" : ""}`}
                onClick={() => setRadialField({ shape })}
                aria-pressed={radial.shape === shape}
              >
                {shape}
              </button>
            ))}
          </div>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="radial-pos-x">
            Position X
          </label>
          <input
            id="radial-pos-x"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={radial.posX}
            onChange={(e) => setRadialField({ posX: Number(e.target.value) })}
          />
          <span className="css-val">{radial.posX}%</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="radial-pos-y">
            Position Y
          </label>
          <input
            id="radial-pos-y"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={radial.posY}
            onChange={(e) => setRadialField({ posY: Number(e.target.value) })}
          />
          <span className="css-val">{radial.posY}%</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span className="css-control-label">Colour Stops</span>
          <GradientStops
            stops={radial.stops}
            onStopChange={setRadialStop}
            onAddStop={addRadialStop}
            onRemoveStop={removeRadialStop}
          />
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div
          className="css-preview-box css-preview-checkerboard"
          style={{ minHeight: 240 }}
          aria-hidden="true"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 240,
              background: gradientValue,
              borderRadius: "var(--radius)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Glassmorphism tab ─────────────────────────────────────────────────────────

function GlassTab() {
  const { glass, setGlass, resetGlass } = useCssStore();
  const css = buildGlassCss(glass);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Controls</span>
          <ResetButton onReset={resetGlass} />
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="glass-blur">
            Blur
          </label>
          <input
            id="glass-blur"
            type="range"
            className="css-range"
            min={0}
            max={40}
            value={glass.blur}
            onChange={(e) => setGlass({ blur: Number(e.target.value) })}
          />
          <span className="css-val">{glass.blur}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="glass-saturation">
            Saturation
          </label>
          <input
            id="glass-saturation"
            type="range"
            className="css-range"
            min={100}
            max={300}
            value={glass.saturation}
            onChange={(e) => setGlass({ saturation: Number(e.target.value) })}
          />
          <span className="css-val">{glass.saturation}%</span>
        </div>

        <div className="css-control-row">
          <span className="css-control-label">BG Colour</span>
          <ColorField value={glass.bgColor} onChange={(hex) => setGlass({ bgColor: hex })} />
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="glass-bg-opacity">
            BG Opacity
          </label>
          <input
            id="glass-bg-opacity"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={Math.round(glass.bgOpacity * 100)}
            onChange={(e) => setGlass({ bgOpacity: Number(e.target.value) / 100 })}
          />
          <span className="css-val">{Math.round(glass.bgOpacity * 100)}%</span>
        </div>

        <div className="css-control-row">
          <label
            className="css-control-label css-control-label--wide"
            htmlFor="glass-border-opacity"
          >
            Border Opacity
          </label>
          <input
            id="glass-border-opacity"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={Math.round(glass.borderOpacity * 100)}
            onChange={(e) => setGlass({ borderOpacity: Number(e.target.value) / 100 })}
          />
          <span className="css-val">{Math.round(glass.borderOpacity * 100)}%</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label css-control-label--wide" htmlFor="glass-radius">
            Border Radius
          </label>
          <input
            id="glass-radius"
            type="range"
            className="css-range"
            min={0}
            max={40}
            value={glass.borderRadius}
            onChange={(e) => setGlass({ borderRadius: Number(e.target.value) })}
          />
          <span className="css-val">{glass.borderRadius}px</span>
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div className="glass-preview-bg" aria-hidden="true">
          <div
            className="glass-preview-card"
            style={{
              background: `rgba(${Number.parseInt(glass.bgColor.slice(1, 3), 16)}, ${Number.parseInt(glass.bgColor.slice(3, 5), 16)}, ${Number.parseInt(glass.bgColor.slice(5, 7), 16)}, ${glass.bgOpacity})`,
              backdropFilter: `blur(${glass.blur}px) saturate(${glass.saturation}%)`,
              WebkitBackdropFilter: `blur(${glass.blur}px) saturate(${glass.saturation}%)`,
              border: `1px solid rgba(${Number.parseInt(glass.bgColor.slice(1, 3), 16)}, ${Number.parseInt(glass.bgColor.slice(3, 5), 16)}, ${Number.parseInt(glass.bgColor.slice(5, 7), 16)}, ${glass.borderOpacity})`,
              borderRadius: `${glass.borderRadius}px`,
            }}
          >
            Glassmorphism
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bezier preset definitions ─────────────────────────────────────────────────

interface BezierPreset {
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const BEZIER_PRESETS: BezierPreset[] = [
  { label: "ease", x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  { label: "ease-in", x1: 0.42, y1: 0, x2: 1, y2: 1 },
  { label: "ease-out", x1: 0, y1: 0, x2: 0.58, y2: 1 },
  { label: "ease-in-out", x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  { label: "linear", x1: 0, y1: 0, x2: 1, y2: 1 },
  { label: "spring", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 },
  { label: "snappy", x1: 0.2, y1: 0, x2: 0, y2: 1 },
];

// ── Cubic Bezier editor ───────────────────────────────────────────────────────

const CANVAS_SIZE = 220;
const CANVAS_PAD = 28;
const PLOT_SIZE = CANVAS_SIZE - CANVAS_PAD * 2;

/** Map a bezier coordinate to canvas pixel. X is clamped 0-1; Y may go outside. */
function toCanvasX(bx: number): number {
  return CANVAS_PAD + clamp(bx, 0, 1) * PLOT_SIZE;
}

function toCanvasY(by: number): number {
  // Y=0 at bottom, Y=1 at top; canvas grows down
  return CANVAS_PAD + (1 - by) * PLOT_SIZE;
}

/** Sample cubic bezier at t, returning [x, y]. */
function sampleBezier(x1: number, y1: number, x2: number, y2: number, t: number): [number, number] {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  // P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1); P0 term vanishes
  const x = 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3;
  const y = 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3;
  return [x, y];
}

function BezierTab() {
  const { bezier, setBezier, resetBezier } = useCssStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<"p1" | "p2" | null>(null);
  const [animating, setAnimating] = useState(false);
  const animFrameRef = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);

  // Local string state for bezier inputs — allows typing partial/in-progress
  // values without clamping on every keystroke. Parsed and clamped on blur.
  const [p1xStr, setP1xStr] = useState(() => bezier.x1.toFixed(3));
  const [p1yStr, setP1yStr] = useState(() => bezier.y1.toFixed(3));
  const [p2xStr, setP2xStr] = useState(() => bezier.x2.toFixed(3));
  const [p2yStr, setP2yStr] = useState(() => bezier.y2.toFixed(3));
  const focusedInputRef = useRef<string | null>(null);

  // Sync string states from bezier when a non-input source changes the value
  // (canvas drag, preset selection), but only if the input isn't focused.
  useEffect(() => {
    if (!focusedInputRef.current) {
      setP1xStr(bezier.x1.toFixed(3));
      setP1yStr(bezier.y1.toFixed(3));
      setP2xStr(bezier.x2.toFixed(3));
      setP2yStr(bezier.y2.toFixed(3));
    }
  }, [bezier]);

  const css = buildBezierRule(bezier);
  const bezierValue = buildBezierValue(bezier);

  const activePreset = BEZIER_PRESETS.find(
    (p) =>
      Math.abs(p.x1 - bezier.x1) < 0.001 &&
      Math.abs(p.y1 - bezier.y1) < 0.001 &&
      Math.abs(p.x2 - bezier.x2) < 0.001 &&
      Math.abs(p.y2 - bezier.y2) < 0.001
  );

  // Draw the bezier canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = `${CANVAS_SIZE}px`;
    canvas.style.height = `${CANVAS_SIZE}px`;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute("data-mantine-color-scheme") === "dark";
    const inkFaint = isDark ? "#5f6e78" : "#9aa3ac";
    const inkMid = isDark ? "#9aa6b0" : "#5b6671";
    const accentColor = isDark ? "#41b6a6" : "#2f9d8d";
    const surfaceSunken = isDark ? "#161b1f" : "#f4f5f6";

    // Background
    ctx.fillStyle = surfaceSunken;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid lines
    ctx.strokeStyle = inkFaint;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    for (let i = 0; i <= 4; i++) {
      const x = CANVAS_PAD + (i / 4) * PLOT_SIZE;
      const y = CANVAS_PAD + (i / 4) * PLOT_SIZE;
      ctx.beginPath();
      ctx.moveTo(x, CANVAS_PAD);
      ctx.lineTo(x, CANVAS_PAD + PLOT_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_PAD, y);
      ctx.lineTo(CANVAS_PAD + PLOT_SIZE, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Control point lines
    const p1cx = toCanvasX(bezier.x1);
    const p1cy = toCanvasY(bezier.y1);
    const p2cx = toCanvasX(bezier.x2);
    const p2cy = toCanvasY(bezier.y2);

    ctx.strokeStyle = inkMid;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(CANVAS_PAD, CANVAS_PAD + PLOT_SIZE);
    ctx.lineTo(p1cx, p1cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CANVAS_PAD + PLOT_SIZE, CANVAS_PAD);
    ctx.lineTo(p2cx, p2cy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Bezier curve
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [bx, by] = sampleBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2, t);
      const cx = CANVAS_PAD + clamp(bx, -0.1, 1.1) * PLOT_SIZE;
      const cy = CANVAS_PAD + (1 - clamp(by, -0.3, 1.3)) * PLOT_SIZE;
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Control point handles
    for (const [hx, hy] of [
      [p1cx, p1cy],
      [p2cx, p2cy],
    ]) {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(hx, hy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = surfaceSunken;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Axis endpoint dots
    ctx.fillStyle = inkMid;
    for (const [px, py] of [
      [CANVAS_PAD, CANVAS_PAD + PLOT_SIZE],
      [CANVAS_PAD + PLOT_SIZE, CANVAS_PAD],
    ]) {
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [bezier]);

  const getCanvasBezierCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const bx = clamp((px - CANVAS_PAD) / PLOT_SIZE, 0, 1);
      const by = 1 - (py - CANVAS_PAD) / PLOT_SIZE;
      return { bx, by };
    },
    []
  );

  const hitTest = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const p1cx = toCanvasX(bezier.x1);
      const p1cy = toCanvasY(bezier.y1);
      const p2cx = toCanvasX(bezier.x2);
      const p2cy = toCanvasY(bezier.y2);
      if (Math.hypot(px - p1cx, py - p1cy) < 12) return "p1" as const;
      if (Math.hypot(px - p2cx, py - p2cy) < 12) return "p2" as const;
      return null;
    },
    [bezier]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const hit = hitTest(e);
      if (hit) setDragging(hit);
    },
    [hitTest]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging) return;
      const coords = getCanvasBezierCoords(e);
      if (!coords) return;
      if (dragging === "p1") setBezier({ x1: coords.bx, y1: coords.by });
      else setBezier({ x2: coords.bx, y2: coords.by });
    },
    [dragging, getCanvasBezierCoords, setBezier]
  );

  const handleMouseUp = useCallback(() => setDragging(null), []);

  // Animation demo
  const runAnimation = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    animStartRef.current = null;
    const duration = 1200;

    const frame = (now: number) => {
      if (!animStartRef.current) animStartRef.current = now;
      const elapsed = now - animStartRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const ball = document.getElementById("bezier-ball");
      if (ball) {
        // Solve for Y at this X progress along the bezier
        // We use Newton's method to find t such that bezierX(t) = progress
        let t = progress;
        for (let i = 0; i < 8; i++) {
          const [bx] = sampleBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2, t);
          const dx = bx - progress;
          // derivative of bezierX w.r.t. t
          const mt = 1 - t;
          const dxdt =
            3 * mt * mt * bezier.x1 +
            6 * mt * t * (bezier.x2 - bezier.x1) +
            3 * t * t * (1 - bezier.x2);
          if (Math.abs(dxdt) > 1e-6) t -= dx / dxdt;
        }
        const [, by] = sampleBezier(bezier.x1, bezier.y1, bezier.x2, bezier.y2, clamp(t, 0, 1));
        const trackWidth = ball.parentElement?.clientWidth ?? 200;
        const pos = clamp(by, 0, 1) * (trackWidth - 12);
        ball.style.transform = `translateX(${pos}px)`;
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setAnimating(false);
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(frame);
  }, [animating, bezier]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Controls</span>
          <ResetButton onReset={resetBezier} />
        </div>

        <div className="bezier-layout">
          <div className="bezier-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="bezier-canvas"
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              aria-label="Cubic bezier curve editor. Drag the teal control points to adjust the curve."
              role="img"
            />
          </div>
          <div className="bezier-presets">
            <span className="css-control-label" style={{ marginBottom: "0.25rem" }}>
              Presets
            </span>
            {BEZIER_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`bezier-preset-btn${activePreset?.label === preset.label ? " bezier-preset-btn--active" : ""}`}
                onClick={() =>
                  setBezier({ x1: preset.x1, y1: preset.y1, x2: preset.x2, y2: preset.y2 })
                }
                aria-pressed={activePreset?.label === preset.label}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bezier-inputs">
          <span className="css-control-label">Control points</span>
          <div className="bezier-input-row">
            <div className="bezier-input-group">
              <label className="bezier-input-label" htmlFor="bezier-x1">
                P1 X
              </label>
              <input
                id="bezier-x1"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={p1xStr}
                onFocus={() => {
                  focusedInputRef.current = "x1";
                }}
                onChange={(e) => setP1xStr(e.target.value)}
                onBlur={() => {
                  focusedInputRef.current = null;
                  const v = Number.parseFloat(p1xStr);
                  if (!Number.isNaN(v)) {
                    const clamped = clamp(v, 0, 1);
                    setBezier({ x1: clamped });
                    setP1xStr(clamped.toFixed(3));
                  } else {
                    setP1xStr(bezier.x1.toFixed(3));
                  }
                }}
                className="bezier-num-input"
              />
            </div>
            <div className="bezier-input-group">
              <label className="bezier-input-label" htmlFor="bezier-y1">
                P1 Y
              </label>
              <input
                id="bezier-y1"
                type="number"
                step="0.01"
                min={-1}
                max={2}
                value={p1yStr}
                onFocus={() => {
                  focusedInputRef.current = "y1";
                }}
                onChange={(e) => setP1yStr(e.target.value)}
                onBlur={() => {
                  focusedInputRef.current = null;
                  const v = Number.parseFloat(p1yStr);
                  if (!Number.isNaN(v)) {
                    const clamped = clamp(v, -1, 2);
                    setBezier({ y1: clamped });
                    setP1yStr(clamped.toFixed(3));
                  } else {
                    setP1yStr(bezier.y1.toFixed(3));
                  }
                }}
                className="bezier-num-input"
              />
            </div>
          </div>
          <div className="bezier-input-row">
            <div className="bezier-input-group">
              <label className="bezier-input-label" htmlFor="bezier-x2">
                P2 X
              </label>
              <input
                id="bezier-x2"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={p2xStr}
                onFocus={() => {
                  focusedInputRef.current = "x2";
                }}
                onChange={(e) => setP2xStr(e.target.value)}
                onBlur={() => {
                  focusedInputRef.current = null;
                  const v = Number.parseFloat(p2xStr);
                  if (!Number.isNaN(v)) {
                    const clamped = clamp(v, 0, 1);
                    setBezier({ x2: clamped });
                    setP2xStr(clamped.toFixed(3));
                  } else {
                    setP2xStr(bezier.x2.toFixed(3));
                  }
                }}
                className="bezier-num-input"
              />
            </div>
            <div className="bezier-input-group">
              <label className="bezier-input-label" htmlFor="bezier-y2">
                P2 Y
              </label>
              <input
                id="bezier-y2"
                type="number"
                step="0.01"
                min={-1}
                max={2}
                value={p2yStr}
                onFocus={() => {
                  focusedInputRef.current = "y2";
                }}
                onChange={(e) => setP2yStr(e.target.value)}
                onBlur={() => {
                  focusedInputRef.current = null;
                  const v = Number.parseFloat(p2yStr);
                  if (!Number.isNaN(v)) {
                    const clamped = clamp(v, -1, 2);
                    setBezier({ y2: clamped });
                    setP2yStr(clamped.toFixed(3));
                  } else {
                    setP2yStr(bezier.y2.toFixed(3));
                  }
                }}
                className="bezier-num-input"
              />
            </div>
          </div>
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Animation Demo</span>
        <div className="bezier-demo-wrap" style={{ marginTop: "0.75rem" }}>
          <span className="bezier-demo-label">{bezierValue}</span>
          <div className="bezier-demo-track" style={{ marginTop: "0.75rem" }}>
            <div id="bezier-ball" className="bezier-demo-ball" />
          </div>
          <button
            type="button"
            className="bezier-demo-btn"
            onClick={runAnimation}
            disabled={animating}
            style={{ marginTop: "0.75rem" }}
          >
            {animating ? "Running..." : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Conic Gradient tab ────────────────────────────────────────────────────────

const CONIC_PRESETS: { label: string; params: ConicGradientParams }[] = [
  {
    label: "Pie",
    params: {
      angle: 0,
      posX: 50,
      posY: 50,
      stops: [
        { id: "c0", color: "#2f9d8d", position: 0 },
        { id: "c1", color: "#e8b04b", position: 33 },
        { id: "c2", color: "#d9594c", position: 66 },
        { id: "c3", color: "#2f9d8d", position: 100 },
      ],
    },
  },
  {
    label: "Wheel",
    params: {
      angle: 0,
      posX: 50,
      posY: 50,
      stops: [
        { id: "c0", color: "#ff0000", position: 0 },
        { id: "c1", color: "#ffff00", position: 17 },
        { id: "c2", color: "#00ff00", position: 33 },
        { id: "c3", color: "#00ffff", position: 50 },
        { id: "c4", color: "#0000ff", position: 67 },
        { id: "c5", color: "#ff00ff", position: 83 },
        { id: "c6", color: "#ff0000", position: 100 },
      ],
    },
  },
  {
    label: "Sunburst",
    params: {
      angle: 45,
      posX: 50,
      posY: 50,
      stops: [
        { id: "c0", color: "#e8b04b", position: 0 },
        { id: "c1", color: "#f7971e", position: 50 },
        { id: "c2", color: "#e8b04b", position: 100 },
      ],
    },
  },
];

function ConicGradientTab() {
  const { conic, setConicField, setConicStop, addConicStop, removeConicStop, resetConic } =
    useCssStore();
  const gradientValue = buildConicGradient(conic);
  const css = buildConicGradientRule(conic);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Presets</span>
          <ResetButton onReset={resetConic} />
        </div>

        <div className="css-presets-row">
          {CONIC_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="bezier-preset-btn"
              onClick={() => useCssStore.setState({ conic: preset.params })}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="conic-angle">
            Start Angle
          </label>
          <input
            id="conic-angle"
            type="range"
            className="css-range"
            min={0}
            max={360}
            value={conic.angle}
            onChange={(e) => setConicField({ angle: Number(e.target.value) })}
          />
          <span className="css-val">{conic.angle}deg</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="conic-pos-x">
            Center X
          </label>
          <input
            id="conic-pos-x"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={conic.posX}
            onChange={(e) => setConicField({ posX: Number(e.target.value) })}
          />
          <span className="css-val">{conic.posX}%</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="conic-pos-y">
            Center Y
          </label>
          <input
            id="conic-pos-y"
            type="range"
            className="css-range"
            min={0}
            max={100}
            value={conic.posY}
            onChange={(e) => setConicField({ posY: Number(e.target.value) })}
          />
          <span className="css-val">{conic.posY}%</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span className="css-control-label">Colour Stops</span>
          <GradientStops
            stops={conic.stops}
            onStopChange={setConicStop}
            onAddStop={addConicStop}
            onRemoveStop={removeConicStop}
          />
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div
          className="css-preview-box css-preview-checkerboard"
          style={{ minHeight: 240 }}
          aria-hidden="true"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              minHeight: 240,
              background: gradientValue,
              borderRadius: "var(--radius)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Border Radius tab ─────────────────────────────────────────────────────────

const RADIUS_PRESETS: { label: string; params: Partial<BorderRadiusParams> }[] = [
  { label: "None", params: { linked: true, all: 0 } },
  { label: "Small", params: { linked: true, all: 6 } },
  { label: "Medium", params: { linked: true, all: 16 } },
  { label: "Large", params: { linked: true, all: 32 } },
  { label: "Pill", params: { linked: true, all: 9999 } },
  {
    label: "Squircle",
    params: {
      linked: false,
      topLeft: 60,
      topRight: 30,
      bottomRight: 60,
      bottomLeft: 30,
    },
  },
];

function BorderRadiusTab() {
  const { borderRadius: br, setBorderRadius, resetBorderRadius } = useCssStore();
  const css = buildBorderRadiusRule(br);
  const previewValue = buildBorderRadiusValue(br);

  const corner = (key: keyof BorderRadiusParams, label: string) => {
    const val = br[key] as number;
    return (
      <div className="css-control-row">
        <label className="css-control-label css-control-label--wide" htmlFor={`br-${key}`}>
          {label}
        </label>
        <input
          id={`br-${key}`}
          type="range"
          className="css-range"
          min={0}
          max={br.unit === "px" ? 200 : 50}
          value={val}
          disabled={br.linked}
          onChange={(e) => setBorderRadius({ [key]: Number(e.target.value) })}
        />
        <span className="css-val">
          {val}
          {br.unit}
        </span>
      </div>
    );
  };

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Presets</span>
          <ResetButton onReset={resetBorderRadius} />
        </div>

        <div className="css-presets-row">
          {RADIUS_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="bezier-preset-btn"
              onClick={() => setBorderRadius(preset.params as Partial<BorderRadiusParams>)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="css-control-row">
          <span className="css-control-label">Unit</span>
          <div className="space-toggle" role="group" aria-label="Radius unit">
            {(["px", "%"] as const).map((u) => (
              <button
                key={u}
                type="button"
                className={`space-btn${br.unit === u ? " space-btn--active" : ""}`}
                onClick={() => setBorderRadius({ unit: u })}
                aria-pressed={br.unit === u}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="br-linked">
            Linked
          </label>
          <input
            id="br-linked"
            type="checkbox"
            checked={br.linked}
            onChange={(e) => setBorderRadius({ linked: e.target.checked })}
            aria-label="Link all corners"
          />
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--ink-faint)",
              fontFamily: "var(--font-mono)",
            }}
          >
            all corners
          </span>
        </div>

        {br.linked ? (
          <div className="css-control-row">
            <label className="css-control-label css-control-label--wide" htmlFor="br-all">
              All corners
            </label>
            <input
              id="br-all"
              type="range"
              className="css-range"
              min={0}
              max={br.unit === "px" ? 200 : 50}
              value={br.all}
              onChange={(e) => setBorderRadius({ all: Number(e.target.value) })}
            />
            <span className="css-val">
              {br.all}
              {br.unit}
            </span>
          </div>
        ) : (
          <>
            {corner("topLeft", "Top Left")}
            {corner("topRight", "Top Right")}
            {corner("bottomRight", "Bottom Right")}
            {corner("bottomLeft", "Bottom Left")}
          </>
        )}

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Preview</span>
        <div
          className="css-preview-box"
          style={{ minHeight: 240, background: "var(--canvas)" }}
          aria-hidden="true"
        >
          <div className="radius-preview-box" style={{ borderRadius: previewValue }} />
        </div>
      </div>
    </div>
  );
}

// ── Transform + Transition tab ────────────────────────────────────────────────

const TRANSITION_PROPERTIES: TransitionProperty[] = [
  "all",
  "opacity",
  "transform",
  "background",
  "color",
  "border",
  "box-shadow",
  "width",
  "height",
];

const EASING_PRESETS: { label: string; value: string }[] = [
  { label: "ease", value: "ease" },
  { label: "ease-in", value: "ease-in" },
  { label: "ease-out", value: "ease-out" },
  { label: "ease-in-out", value: "ease-in-out" },
  { label: "linear", value: "linear" },
  { label: "spring", value: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
  { label: "snappy", value: "cubic-bezier(0.2, 0, 0, 1)" },
];

function TransformTab() {
  const {
    transform: tf,
    setTransform,
    resetTransform,
    transition: tr,
    setTransition,
    resetTransition,
  } = useCssStore();
  const css = buildTransitionRule(tf, tr);
  const [previewing, setPreviewing] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);

  const runPreview = useCallback(() => {
    if (!previewRef.current || previewing) return;
    setPreviewing(true);
    previewRef.current.style.transition = "none";
    previewRef.current.style.transform = "none";

    // Force reflow then apply
    void previewRef.current.offsetWidth;
    previewRef.current.style.transition = `${tr.property} ${tr.duration}ms ${tr.easing}${tr.delay > 0 ? ` ${tr.delay}ms` : ""}`;
    previewRef.current.style.transform = buildTransformValue(tf);

    setTimeout(
      () => {
        setPreviewing(false);
      },
      tr.duration + tr.delay + 200
    );
  }, [previewing, tf, tr]);

  return (
    <div className="css-layout">
      <div className="card css-controls-panel">
        <div className="css-panel-header">
          <span className="css-preview-label">Transform</span>
          <ResetButton
            onReset={() => {
              resetTransform();
              resetTransition();
            }}
          />
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-translate-x">
            Translate X
          </label>
          <input
            id="tf-translate-x"
            type="range"
            className="css-range"
            min={-200}
            max={200}
            value={tf.translateX}
            onChange={(e) => setTransform({ translateX: Number(e.target.value) })}
          />
          <span className="css-val">{tf.translateX}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-translate-y">
            Translate Y
          </label>
          <input
            id="tf-translate-y"
            type="range"
            className="css-range"
            min={-200}
            max={200}
            value={tf.translateY}
            onChange={(e) => setTransform({ translateY: Number(e.target.value) })}
          />
          <span className="css-val">{tf.translateY}px</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-rotate">
            Rotate
          </label>
          <input
            id="tf-rotate"
            type="range"
            className="css-range"
            min={-360}
            max={360}
            value={tf.rotate}
            onChange={(e) => setTransform({ rotate: Number(e.target.value) })}
          />
          <span className="css-val">{tf.rotate}deg</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-scale-x">
            Scale X
          </label>
          <input
            id="tf-scale-x"
            type="range"
            className="css-range"
            min={0}
            max={300}
            value={Math.round(tf.scaleX * 100)}
            onChange={(e) => setTransform({ scaleX: Number(e.target.value) / 100 })}
          />
          <span className="css-val">{tf.scaleX.toFixed(2)}</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-scale-y">
            Scale Y
          </label>
          <input
            id="tf-scale-y"
            type="range"
            className="css-range"
            min={0}
            max={300}
            value={Math.round(tf.scaleY * 100)}
            onChange={(e) => setTransform({ scaleY: Number(e.target.value) / 100 })}
          />
          <span className="css-val">{tf.scaleY.toFixed(2)}</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-skew-x">
            Skew X
          </label>
          <input
            id="tf-skew-x"
            type="range"
            className="css-range"
            min={-60}
            max={60}
            value={tf.skewX}
            onChange={(e) => setTransform({ skewX: Number(e.target.value) })}
          />
          <span className="css-val">{tf.skewX}deg</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tf-skew-y">
            Skew Y
          </label>
          <input
            id="tf-skew-y"
            type="range"
            className="css-range"
            min={-60}
            max={60}
            value={tf.skewY}
            onChange={(e) => setTransform({ skewY: Number(e.target.value) })}
          />
          <span className="css-val">{tf.skewY}deg</span>
        </div>

        <div className="css-panel-header" style={{ marginTop: "0.5rem" }}>
          <span className="css-preview-label">Transition</span>
        </div>

        <div className="css-control-row">
          <span className="css-control-label">Property</span>
          <select
            className="css-select"
            value={tr.property}
            onChange={(e) => setTransition({ property: e.target.value as TransitionProperty })}
            aria-label="Transition property"
          >
            {TRANSITION_PROPERTIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tr-duration">
            Duration
          </label>
          <input
            id="tr-duration"
            type="range"
            className="css-range"
            min={0}
            max={2000}
            step={50}
            value={tr.duration}
            onChange={(e) => setTransition({ duration: Number(e.target.value) })}
          />
          <span className="css-val">{tr.duration}ms</span>
        </div>

        <div className="css-control-row">
          <label className="css-control-label" htmlFor="tr-delay">
            Delay
          </label>
          <input
            id="tr-delay"
            type="range"
            className="css-range"
            min={0}
            max={1000}
            step={50}
            value={tr.delay}
            onChange={(e) => setTransition({ delay: Number(e.target.value) })}
          />
          <span className="css-val">{tr.delay}ms</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <span className="css-control-label">Easing</span>
          <div className="css-presets-row">
            {EASING_PRESETS.map((ep) => (
              <button
                key={ep.label}
                type="button"
                className={`bezier-preset-btn${tr.easing === ep.value ? " bezier-preset-btn--active" : ""}`}
                onClick={() => setTransition({ easing: ep.value })}
                aria-pressed={tr.easing === ep.value}
              >
                {ep.label}
              </button>
            ))}
          </div>
        </div>

        <div className="css-output-wrap">
          <div className="css-output-header">
            <span className="css-preview-label">CSS Output</span>
            <CopyButton text={css} />
          </div>
          <pre className="css-output" aria-label="Generated CSS">
            {css}
          </pre>
        </div>
      </div>

      <div className="card css-preview-panel">
        <span className="css-preview-label">Animation Demo</span>
        <div className="transform-preview-wrap" aria-hidden="true">
          <div className="transform-preview-stage">
            <div ref={previewRef} className="transform-preview-box" />
          </div>
          <button
            type="button"
            className="bezier-demo-btn"
            onClick={runPreview}
            disabled={previewing}
            style={{ marginTop: "0.75rem" }}
          >
            {previewing ? "Running..." : "Play"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

/** Return the CSS output string for the currently active tab (for Cmd+Enter copy). */
function useActiveTabCss(): string {
  const {
    activeTab,
    shadow,
    linear,
    radial,
    conic,
    glass,
    bezier,
    borderRadius,
    transform,
    transition,
  } = useCssStore();
  switch (activeTab) {
    case "shadow":
      return buildBoxShadowRule(shadow);
    case "linear":
      return buildLinearGradientRule(linear);
    case "radial":
      return buildRadialGradientRule(radial);
    case "conic":
      return buildConicGradientRule(conic);
    case "glass":
      return buildGlassCss(glass);
    case "bezier":
      return buildBezierRule(bezier);
    case "radius":
      return buildBorderRadiusRule(borderRadius);
    case "transform":
      return buildTransitionRule(transform, transition);
    default:
      return "";
  }
}

export function App() {
  const { activeTab, setActiveTab } = useCssStore();
  const activeTabCss = useActiveTabCss();

  // Cmd/Ctrl+Enter copies the current tab's CSS
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (activeTabCss) navigator.clipboard.writeText(activeTabCss).catch(() => {});
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTabCss]);

  return (
    <div className="app-root">
      <Header
        title="CSS Toolkit"
        subtitle="shadow, gradient, glassmorphism, border-radius, transform"
        brandMark={
          <BrandMark label="CSS Toolkit">
            <CssBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <div className="css-tabs" role="tablist" aria-label="CSS generator tools">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              className={`space-btn${activeTab === value ? " space-btn--active" : ""}`}
              onClick={() => setActiveTab(value)}
              aria-selected={activeTab === value}
              id={`tab-${value}`}
              aria-controls={`panel-${value}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "shadow" && <BoxShadowTab />}
          {activeTab === "linear" && <LinearGradientTab />}
          {activeTab === "radial" && <RadialGradientTab />}
          {activeTab === "conic" && <ConicGradientTab />}
          {activeTab === "glass" && <GlassTab />}
          {activeTab === "bezier" && <BezierTab />}
          {activeTab === "radius" && <BorderRadiusTab />}
          {activeTab === "transform" && <TransformTab />}
        </div>

        <p className="css-privacy-note">
          Runs entirely in your browser. No data is uploaded or stored.
        </p>
      </main>

      <Footer blurb="100% client-side. No upload, no account." />
    </div>
  );
}
