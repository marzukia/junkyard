import { useCallback, useState } from "react";
import { useBlackText } from "../lib/color";

interface SwatchBandProps {
  hex: string;
  /** Display-only colour override (CVD simulation). Copy/clipboard always uses `hex`. */
  displayHex?: string;
  index: number;
}

type CopyState = "idle" | "copied" | "error";

export function SwatchBand({ hex, displayHex, index }: SwatchBandProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  // Text contrast is based on the visual colour so labels remain legible under simulation
  const bgForContrast = displayHex ?? hex;
  const blackText = useBlackText(bgForContrast);
  const textColor = blackText ? "#16140F" : "#FAF9F5";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context)
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1400);
    }
  }, [hex]);

  return (
    <li className="swatch-band-item">
      <button
        type="button"
        className="swatch-band"
        style={{ backgroundColor: displayHex ?? hex, color: textColor }}
        onClick={handleCopy}
        aria-label={`Color ${hex}, click to copy`}
      >
        <span className="swatch-index" style={{ color: textColor, opacity: 0.5 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        {/* Always show the real hex — copy copies the real value */}
        <span className="swatch-hex">
          {copyState === "copied" ? "copied" : copyState === "error" ? "couldn't copy" : hex}
        </span>
      </button>
    </li>
  );
}
