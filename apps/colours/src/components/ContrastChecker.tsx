import { useMemo, useState } from "react";
import { contrastRatio, wcagAssessment } from "../lib/contrast";
import { useColoursStore } from "../store";
import { ColorInput } from "./ColorInput";

// Default: dark ink on canvas (legible pair regardless of theme)
const DEFAULT_FG = "#1a2530";
const DEFAULT_BG = "#fafafa";

function PassBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <span
      className={`contrast-badge${pass ? " contrast-badge--pass" : " contrast-badge--fail"}`}
      aria-label={`${label}: ${pass ? "pass" : "fail"}`}
    >
      {pass ? "✓" : "✗"} {label}
    </span>
  );
}

export function ContrastChecker() {
  // Seed defaults from first two palette colours if available, otherwise fixed defaults
  const paletteColors = useColoursStore((s) => s.palette.colors);
  const [fg, setFg] = useState<string>(paletteColors[0] ?? DEFAULT_FG);
  const [bg, setBg] = useState<string>(paletteColors[1] ?? DEFAULT_BG);

  const ratio = useMemo(() => contrastRatio(fg, bg), [fg, bg]);
  const assessment = useMemo(() => wcagAssessment(ratio), [ratio]);

  const ratioDisplay = `${ratio.toFixed(2)}:1`;

  return (
    <section className="generator-panel contrast-panel" aria-labelledby="contrast-heading">
      <header className="generator-header">
        <h2 id="contrast-heading" className="generator-title">
          Contrast
        </h2>
        <p className="generator-desc">WCAG 2.x checker</p>
      </header>

      <div className="contrast-body">
        {/* Colour inputs */}
        <div className="color-inputs-row contrast-inputs">
          <ColorInput label="Foreground" value={fg} onChange={setFg} />
          <ColorInput label="Background" value={bg} onChange={setBg} />
        </div>

        {/* Results row */}
        <div className="contrast-results">
          {/* Big ratio */}
          <div className="contrast-ratio-block">
            <span className="contrast-ratio" aria-label={`Contrast ratio ${ratioDisplay}`}>
              {ratioDisplay}
            </span>
            <span className="contrast-ratio-label">contrast ratio</span>
          </div>

          {/* "Aa" live preview */}
          <div
            className="contrast-preview"
            style={{ backgroundColor: bg, color: fg }}
            aria-hidden="true"
          >
            Aa
          </div>

          {/* WCAG badges */}
          <ul className="contrast-badges" aria-label="WCAG pass/fail results">
            <li className="contrast-badge-group">
              <span className="contrast-badge-level">AA</span>
              <PassBadge pass={assessment.aaNormal} label="Normal" />
              <PassBadge pass={assessment.aaLarge} label="Large" />
            </li>
            <li className="contrast-badge-group">
              <span className="contrast-badge-level">AAA</span>
              <PassBadge pass={assessment.aaaNormal} label="Normal" />
              <PassBadge pass={assessment.aaaLarge} label="Large" />
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
