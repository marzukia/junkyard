import { Slider } from "@mantine/core";
import { useMemo } from "react";
import { interpolateTwo } from "../lib/color";
import { simulate } from "../lib/cvd";
import { useColoursStore } from "../store";
import { ColorInput } from "./ColorInput";
import { GradientOutput } from "./GradientOutput";

export function TwoPointGenerator() {
  const { start, end, steps } = useColoursStore((s) => s.twoPoint);
  const setTwoPoint = useColoursStore((s) => s.setTwoPoint);
  const space = useColoursStore((s) => s.space);
  const cvdMode = useColoursStore((s) => s.cvdMode);

  const colors = useMemo(
    () => interpolateTwo(start, end, steps, space),
    [start, end, steps, space]
  );

  const displayColors = useMemo(
    () => (cvdMode === "none" ? undefined : colors.map((hex) => simulate(hex, cvdMode))),
    [colors, cvdMode]
  );

  return (
    <section className="generator-panel" aria-labelledby="two-point-heading">
      <header className="generator-header">
        <h2 id="two-point-heading" className="generator-title">
          2-Point
        </h2>
        <p className="generator-desc">Start → End</p>
      </header>

      <div className="generator-controls">
        <div className="color-inputs-row">
          <ColorInput label="Start" value={start} onChange={(hex) => setTwoPoint({ start: hex })} />
          <ColorInput label="End" value={end} onChange={(hex) => setTwoPoint({ end: hex })} />
        </div>

        <div className="slider-row">
          <label className="slider-label" htmlFor="two-point-steps">
            Steps
            <span className="slider-value">{steps}</span>
          </label>
          <Slider
            id="two-point-steps"
            min={3}
            max={20}
            step={1}
            value={steps}
            onChange={(v) => setTwoPoint({ steps: v })}
            aria-label="Number of steps"
            className="step-slider"
          />
        </div>
      </div>

      <GradientOutput colors={colors} displayColors={displayColors} />
    </section>
  );
}
