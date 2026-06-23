import { COLOR_SPACES } from "../lib/color";
import type { ColorSpace } from "../lib/color";
import { useColoursStore } from "../store";

const SPACE_META: Record<ColorSpace, { label: string; description: string }> = {
  lab: { label: "LAB", description: "Perceptually uniform (default)" },
  rgb: { label: "RGB", description: "Linear RGB channels" },
  hsl: { label: "HSL", description: "Hue / saturation / lightness" },
};

const SPACES = COLOR_SPACES.map((value) => ({ value, ...SPACE_META[value] }));

export function SpaceToggle() {
  const space = useColoursStore((s) => s.space);
  const setSpace = useColoursStore((s) => s.setSpace);

  return (
    <div className="space-toggle-wrapper">
      <span className="space-toggle-label">Interpolation space</span>
      <div className="space-toggle" aria-label="Color interpolation space">
        {SPACES.map(({ value, label, description }) => (
          <button
            key={value}
            type="button"
            className={`space-btn${space === value ? " space-btn--active" : ""}`}
            onClick={() => setSpace(value)}
            aria-pressed={space === value}
            title={description}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
