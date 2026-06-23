import { CVD_TYPES } from "../lib/cvd";
import type { CvdType } from "../lib/cvd";
import { useColoursStore } from "../store";

const LABELS: Record<CvdType, string> = {
  none: "Normal",
  protanopia: "Protanopia",
  deuteranopia: "Deuteranopia",
  tritanopia: "Tritanopia",
  achromatopsia: "Achromato.",
};

export function VisionToggle() {
  const cvdMode = useColoursStore((s) => s.cvdMode);
  const setCvdMode = useColoursStore((s) => s.setCvdMode);

  return (
    <div className="space-toggle-wrapper">
      <span className="space-toggle-label">Vision</span>
      <div className="space-toggle" aria-label="Colour vision simulation">
        {CVD_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={`space-btn${cvdMode === type ? " space-btn--active" : ""}`}
            onClick={() => setCvdMode(type)}
            aria-pressed={cvdMode === type}
            title={type === "none" ? "No simulation" : `Simulate ${type}`}
          >
            {LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}
