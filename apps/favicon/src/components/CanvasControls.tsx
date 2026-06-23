import { useFaviconStore } from "../lib/faviconStore";

/** Slider with associated label */
function Slider({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label
          htmlFor={id}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.6rem",
            fontWeight: 500,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          {label}
        </label>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.62rem",
            color: "var(--ink-mid)",
          }}
        >
          {display}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
    </div>
  );
}

export function CanvasControls() {
  const { canvasOptions, setCanvasOptions } = useFaviconStore();

  const paddingPct = Math.round(canvasOptions.padding * 100);
  const cornerPct = Math.round(canvasOptions.cornerRadius * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <span className="section-label">Canvas options</span>

      {/* Background colour */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.6rem",
              fontWeight: 500,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            Background
          </span>
          {canvasOptions.bgColor && (
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: "0.65rem", padding: "0.15rem 0.55rem" }}
              onClick={() => setCanvasOptions({ bgColor: "" })}
            >
              None
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label htmlFor="canvas-bg-color" style={{ display: "contents" }}>
            <input
              id="canvas-bg-color"
              type="color"
              value={canvasOptions.bgColor || "#2f9d8d"}
              onChange={(e) => setCanvasOptions({ bgColor: e.target.value })}
              style={{
                width: "36px",
                height: "36px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius-sm)",
                padding: "2px",
                background: "var(--surface)",
                cursor: "pointer",
                flexShrink: 0,
              }}
              title="Pick background colour"
            />
          </label>
          <input
            type="text"
            aria-label="Background colour hex value"
            value={canvasOptions.bgColor}
            onChange={(e) => {
              const v = e.target.value;
              // Accept valid hex while typing
              if (!v || /^#[0-9a-fA-F]{0,6}$/.test(v)) {
                setCanvasOptions({ bgColor: v });
              }
            }}
            placeholder="transparent"
            maxLength={7}
            style={{
              flex: 1,
              padding: "0.45rem 0.7rem",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              color: "var(--ink)",
              outline: "none",
            }}
          />
        </div>
      </div>

      <Slider
        id="canvas-padding"
        label="Padding"
        value={paddingPct}
        min={0}
        max={30}
        step={2}
        onChange={(v) => setCanvasOptions({ padding: v / 100 })}
        display={`${paddingPct}%`}
      />

      <Slider
        id="canvas-corner-radius"
        label="Corner radius"
        value={cornerPct}
        min={0}
        max={50}
        step={2}
        onChange={(v) => setCanvasOptions({ cornerRadius: v / 100 })}
        display={cornerPct === 50 ? "circle" : `${cornerPct}%`}
      />
    </div>
  );
}
