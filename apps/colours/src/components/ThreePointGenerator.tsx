import { Slider } from "@mantine/core";
import { useMemo } from "react";
import { interpolateThree } from "../lib/color";
import { simulate } from "../lib/cvd";
import { useColoursStore } from "../store";
import { ColorInput } from "./ColorInput";
import { GradientOutput } from "./GradientOutput";

export function ThreePointGenerator() {
  const { start, mid, end, steps } = useColoursStore((s) => s.threePoint);
  const setThreePoint = useColoursStore((s) => s.setThreePoint);
  const space = useColoursStore((s) => s.space);
  const cvdMode = useColoursStore((s) => s.cvdMode);

  const colors = useMemo(
    () => interpolateThree(start, mid, end, steps, space),
    [start, mid, end, steps, space]
  );

  const displayColors = useMemo(
    () => (cvdMode === "none" ? undefined : colors.map((hex) => simulate(hex, cvdMode))),
    [colors, cvdMode]
  );

  return (
    <section className="generator-panel" aria-labelledby="three-point-heading">
      <header className="generator-header">
        <h2 id="three-point-heading" className="generator-title">
          3-Point
        </h2>
        <p className="generator-desc">Start → Mid → End</p>
      </header>

      <div className="generator-controls">
        <div className="color-inputs-row color-inputs-row--three">
          <ColorInput
            label="Start"
            value={start}
            onChange={(hex) => setThreePoint({ start: hex })}
          />
          <ColorInput label="Mid" value={mid} onChange={(hex) => setThreePoint({ mid: hex })} />
          <ColorInput label="End" value={end} onChange={(hex) => setThreePoint({ end: hex })} />
        </div>

        <div className="slider-row">
          <label className="slider-label" htmlFor="three-point-steps">
            Steps
            <span className="slider-value">{steps}</span>
          </label>
          <Slider
            id="three-point-steps"
            min={3}
            max={20}
            step={1}
            value={steps}
            onChange={(v) => setThreePoint({ steps: v })}
            aria-label="Number of steps"
            className="step-slider"
          />
        </div>
      </div>

      <GradientOutput colors={colors} displayColors={displayColors} />
    </section>
  );
}
