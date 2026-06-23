import { useCallback, useState } from "react";
import { toCssGradient } from "../lib/color";
import { SwatchBand } from "./SwatchBand";

interface GradientOutputProps {
  colors: string[];
  /** Display-only colours for CVD simulation. Must be same length as `colors` if provided.
   *  Copy/export always use the real `colors`. */
  displayColors?: string[];
}

type CopyState = "idle" | "copied" | "error";

export function GradientOutput({ colors, displayColors }: GradientOutputProps) {
  const [cssCopy, setCssCopy] = useState<CopyState>("idle");
  const [arrCopy, setArrCopy] = useState<CopyState>("idle");

  // Preview bar uses simulated colours when active; copy always uses real colours
  const visibleColors = displayColors ?? colors;
  // Two separate gradient strings: one for the visual preview (simulated), one
  // for clipboard export (always the real palette — CVD simulation must never
  // reach the clipboard or any export path).
  const previewGradient = toCssGradient(visibleColors);
  const realGradient = toCssGradient(colors);

  const handleCopyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(realGradient);
      setCssCopy("copied");
      setTimeout(() => setCssCopy("idle"), 1400);
    } catch {
      setCssCopy("error");
      setTimeout(() => setCssCopy("idle"), 1400);
    }
  }, [realGradient]);

  const handleCopyArray = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(colors));
      setArrCopy("copied");
      setTimeout(() => setArrCopy("idle"), 1400);
    } catch {
      setArrCopy("error");
      setTimeout(() => setArrCopy("idle"), 1400);
    }
  }, [colors]);

  return (
    <div className="gradient-output">
      {/* Smooth gradient preview bar */}
      <div
        className="gradient-preview-bar"
        style={{ background: previewGradient }}
        aria-hidden="true"
      />

      {/* Stepped swatch bands */}
      <ul className="swatch-bands" aria-label="Color steps">
        {colors.map((hex, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: gradient steps are always positional; index is the stable identity
          <SwatchBand key={i} hex={hex} displayHex={displayColors?.[i]} index={i} />
        ))}
      </ul>

      {/* Copy actions */}
      <div className="copy-actions">
        <button
          type="button"
          className="copy-btn"
          onClick={handleCopyCss}
          aria-label="Copy CSS linear-gradient"
        >
          {cssCopy === "copied" ? "copied" : cssCopy === "error" ? "couldn't copy" : "Copy CSS"}
        </button>
        <button
          type="button"
          className="copy-btn"
          onClick={handleCopyArray}
          aria-label="Copy color array as JSON"
        >
          {arrCopy === "copied" ? "copied" : arrCopy === "error" ? "couldn't copy" : "Copy array"}
        </button>
      </div>
    </div>
  );
}
