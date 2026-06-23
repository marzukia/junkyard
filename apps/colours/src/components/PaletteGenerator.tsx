import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeHex, useBlackText } from "../lib/color";
import { simulate } from "../lib/cvd";
import { formatCss } from "../lib/export";
import { HARMONY_MODES } from "../lib/palette";
import type { HarmonyMode } from "../store";
import { MAX_PALETTE_COUNT, MIN_PALETTE_COUNT, useColoursStore } from "../store";
import { ExportPanel } from "./ExportPanel";
import { ImagePalette } from "./ImagePalette";

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function LockClosedIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1" />
      <path
        d="M5 7V5a3 3 0 0 1 6 0v2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.35"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect
        x="5"
        y="5"
        width="9"
        height="9"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M4 11H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3,8 7,12 13,4" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 6h7a5 5 0 0 1 0 10H5" />
      <polyline points="2,2 2,6 6,6" />
    </svg>
  );
}

// ── Swatch column ─────────────────────────────────────────────────────────────

interface PaletteSwatchProps {
  hex: string;
  /** Display-only colour override (CVD simulation). Copy and labels always use `hex`. */
  displayHex?: string;
  locked: boolean;
  index: number;
  onToggleLock: () => void;
  onSetColor: (hex: string) => void;
}

type CopyState = "idle" | "copied" | "error";

function PaletteSwatch({
  hex,
  displayHex,
  locked,
  index,
  onToggleLock,
  onSetColor,
}: PaletteSwatchProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [editValue, setEditValue] = useState(hex);
  const [isEditing, setIsEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Text contrast based on the visual colour so it stays legible under simulation
  const bgForContrast = displayHex ?? hex;
  const blackText = useBlackText(bgForContrast);
  const textColor = blackText ? "#16140F" : "#FAF9F5";

  // Keep the edit field in sync when the colour changes externally (regenerate, lock, etc.)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(hex);
      setInvalid(false);
    }
  }, [hex, isEditing]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1400);
    }
  }, [hex]);

  // Commit an edited hex: if valid, set the colour (which locks the slot); else flag invalid.
  const commitEdit = useCallback(() => {
    const normalized = normalizeHex(editValue);
    if (normalized) {
      setInvalid(false);
      setIsEditing(false);
      if (normalized !== hex) onSetColor(normalized);
      else setEditValue(hex);
    } else {
      setInvalid(true);
    }
  }, [editValue, hex, onSetColor]);

  const startEdit = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, []);

  const hexDisplay =
    copyState === "copied" ? "copied!" : copyState === "error" ? "error" : hex.toUpperCase();

  return (
    <li className="palette-swatch-col">
      <div className="palette-swatch-body" style={{ backgroundColor: displayHex ?? hex }}>
        {/* Overlay — hover-revealed on desktop, always visible on touch/mobile */}
        <div className="palette-swatch-overlay" style={{ color: textColor }}>
          {/* Lock toggle */}
          <button
            type="button"
            className={`swatch-overlay-lock${locked ? " swatch-overlay-lock--locked" : ""}`}
            style={{ color: textColor, borderColor: `${textColor}40` }}
            onClick={onToggleLock}
            aria-pressed={locked}
            aria-label={locked ? `Unlock swatch ${index + 1}` : `Lock swatch ${index + 1}`}
            title={locked ? "Locked — won't change on regenerate" : "Unlocked — will regenerate"}
          >
            {locked ? <LockClosedIcon /> : <LockOpenIcon />}
          </button>

          {/* Hex display / inline edit */}
          <div className="swatch-overlay-hex-area">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                className={`swatch-overlay-edit${invalid ? " swatch-overlay-edit--invalid" : ""}`}
                style={{
                  color: invalid ? "#ff6b6b" : textColor,
                  borderColor: invalid ? "#ff6b6b" : `${textColor}60`,
                  caretColor: textColor,
                }}
                value={editValue}
                spellCheck={false}
                maxLength={7}
                onChange={(e) => setEditValue(e.currentTarget.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    setIsEditing(false);
                    setEditValue(hex);
                    setInvalid(false);
                  }
                }}
                aria-label={`Edit swatch ${index + 1} hex`}
                aria-invalid={invalid}
              />
            ) : (
              <button
                type="button"
                className="swatch-overlay-hex"
                style={{ color: textColor }}
                onClick={startEdit}
                title="Click to edit hex"
                aria-label={`Swatch ${index + 1}: ${hex}, click to edit`}
              >
                {hexDisplay}
              </button>
            )}
          </div>

          {/* Copy button */}
          <button
            type="button"
            className={`swatch-overlay-copy${copyState === "copied" ? " swatch-overlay-copy--copied" : ""}`}
            style={{ color: textColor, borderColor: `${textColor}40` }}
            onClick={handleCopy}
            aria-label={
              copyState === "copied"
                ? `Copied swatch ${index + 1} hex`
                : `Copy swatch ${index + 1} hex`
            }
            title={copyState === "copied" ? "Copied!" : "Copy hex"}
          >
            {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Recent palette strip ──────────────────────────────────────────────────────

interface RecentSwatchProps {
  colors: string[];
  onLoad: () => void;
}

function RecentSwatch({ colors, onLoad }: RecentSwatchProps) {
  const segments = colors.slice(0, 6);
  return (
    <button
      type="button"
      className="recent-swatch"
      onClick={onLoad}
      title="Restore this palette"
      aria-label={`Restore palette: ${colors.join(", ")}`}
    >
      {segments.map((hex, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional segments
        <span key={i} className="recent-swatch-seg" style={{ background: hex }} />
      ))}
    </button>
  );
}

// ── Main palette section ──────────────────────────────────────────────────────

type ArrayCopyState = "idle" | "copied" | "error";
type CssCopyState = "idle" | "copied" | "error";

export function PaletteGenerator() {
  const { colors, locked, count, harmonyMode } = useColoursStore((s) => s.palette);
  const regeneratePaletteColors = useColoursStore((s) => s.regeneratePaletteColors);
  const resetPalette = useColoursStore((s) => s.resetPalette);
  const setPaletteCount = useColoursStore((s) => s.setPaletteCount);
  const setPaletteHarmony = useColoursStore((s) => s.setPaletteHarmony);
  const togglePaletteLock = useColoursStore((s) => s.togglePaletteLock);
  const setPaletteColor = useColoursStore((s) => s.setPaletteColor);
  const cvdMode = useColoursStore((s) => s.cvdMode);
  const canUndo = useColoursStore((s) => s.canUndo);
  const undoPalette = useColoursStore((s) => s.undoPalette);
  const recentPalettes = useColoursStore((s) => s.recentPalettes);
  const loadImagePalette = useColoursStore((s) => s.loadImagePalette);

  const displayColors = useMemo(
    () => (cvdMode === "none" ? undefined : colors.map((hex) => simulate(hex, cvdMode))),
    [colors, cvdMode]
  );

  const [arrayCopy, setArrayCopy] = useState<ArrayCopyState>("idle");
  const [cssCopy, setCssCopy] = useState<CssCopyState>("idle");
  const [showExport, setShowExport] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Spacebar regenerates only when focus is on the document body (no interactive element focused).
  // This prevents hijacking Space from buttons, links, sliders, inputs, and other controls.
  // Cmd/Ctrl+Enter also triggers generate (fleet-wide power-user shortcut).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+Enter: always generate regardless of focus
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        regeneratePaletteColors();
        return;
      }
      if (e.code !== "Space") return;
      const active = document.activeElement;
      // Only fire when nothing interactive holds focus
      if (active && active !== document.body) return;
      e.preventDefault();
      regeneratePaletteColors();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [regeneratePaletteColors]);

  const handleCopyArray = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(colors));
      setArrayCopy("copied");
      setTimeout(() => setArrayCopy("idle"), 1400);
    } catch {
      setArrayCopy("error");
      setTimeout(() => setArrayCopy("idle"), 1400);
    }
  }, [colors]);

  const handleCopyCss = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatCss(colors));
      setCssCopy("copied");
      setTimeout(() => setCssCopy("idle"), 1400);
    } catch {
      setCssCopy("error");
      setTimeout(() => setCssCopy("idle"), 1400);
    }
  }, [colors]);

  // Recent palettes: exclude the current palette (index 0 = current) and show the rest
  const recentHistory = recentPalettes.slice(1);

  return (
    <section className="palette-section" aria-labelledby="palette-heading">
      {/* Header row */}
      <div className="palette-header">
        <div className="palette-header-left">
          <h2 id="palette-heading" className="generator-title">
            Palette
          </h2>
          <p className="generator-desc">Harmonious colour set</p>
        </div>

        <div className="palette-controls">
          {/* Harmony mode toggle */}
          <div className="palette-control-group">
            <span className="palette-control-label">Harmony</span>
            <div className="space-toggle" aria-label="Harmony mode">
              {HARMONY_MODES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`space-btn${harmonyMode === value ? " space-btn--active" : ""}`}
                  onClick={() => setPaletteHarmony(value as HarmonyMode)}
                  aria-pressed={harmonyMode === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Count control */}
          <div className="palette-control-group">
            <span className="palette-control-label">Count</span>
            <div className="palette-count-control">
              <button
                type="button"
                className="palette-count-btn"
                onClick={() => setPaletteCount(count - 1)}
                disabled={count <= MIN_PALETTE_COUNT}
                aria-label="Remove swatch"
              >
                −
              </button>
              <span className="palette-count-value">{count}</span>
              <button
                type="button"
                className="palette-count-btn"
                onClick={() => setPaletteCount(count + 1)}
                disabled={count >= MAX_PALETTE_COUNT}
                aria-label="Add swatch"
              >
                +
              </button>
            </div>
          </div>

          {/* Generate button */}
          <button
            type="button"
            className="palette-generate-btn"
            onClick={regeneratePaletteColors}
            aria-label="Generate new palette (Space or Cmd+Enter)"
            title="Generate (Space or Cmd+Enter)"
          >
            Generate
          </button>

          {/* Undo button */}
          {canUndo && (
            <button
              type="button"
              className="palette-undo-btn"
              onClick={undoPalette}
              aria-label="Undo last palette change"
              title="Undo"
            >
              <UndoIcon />
            </button>
          )}

          {/* Reset button — clears locks and returns to a fresh 5-swatch analogous palette */}
          <button
            type="button"
            className="palette-reset-btn"
            onClick={resetPalette}
            aria-label="Reset palette to defaults"
            title="Clear all locks and reset to a fresh palette"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Swatches row */}
      <ul className="palette-swatches" aria-label="Palette swatches">
        {colors.map((hex, i) => (
          <PaletteSwatch
            // biome-ignore lint/suspicious/noArrayIndexKey: palette swatches are positional by design
            key={i}
            hex={hex}
            displayHex={displayColors?.[i]}
            locked={locked[i] ?? false}
            index={i}
            onToggleLock={() => togglePaletteLock(i)}
            onSetColor={(c) => setPaletteColor(i, c)}
          />
        ))}
      </ul>

      {/* Export panel (inline, toggled) */}
      {showExport && <ExportPanel colors={colors} />}

      {/* Image upload panel (inline, toggled) */}
      {showImageUpload && (
        <div className="image-palette-panel">
          <ImagePalette />
        </div>
      )}

      {/* Recent palettes strip */}
      {recentHistory.length > 0 && (
        <div className="recent-palettes" aria-label="Recent palettes">
          <span className="palette-control-label">Recent</span>
          <div className="recent-palettes-row">
            {recentHistory.map((palette, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: ordered by recency, stable within session
              <RecentSwatch key={i} colors={palette} onLoad={() => loadImagePalette(palette)} />
            ))}
          </div>
        </div>
      )}

      {/* Footer: spacebar hint + copy actions + export toggle */}
      <div className="palette-footer">
        <span className="palette-hint">space or Cmd+Enter to generate</span>
        <div className="copy-actions palette-copy-actions">
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopyArray}
            aria-label="Copy palette as JSON array"
          >
            {arrayCopy === "copied"
              ? "copied"
              : arrayCopy === "error"
                ? "couldn't copy"
                : "Copy array"}
          </button>
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopyCss}
            aria-label="Copy palette as CSS custom properties"
          >
            {cssCopy === "copied" ? "copied" : cssCopy === "error" ? "couldn't copy" : "Copy CSS"}
          </button>
          <button
            type="button"
            className={`copy-btn${showImageUpload ? " copy-btn--active" : ""}`}
            onClick={() => setShowImageUpload((v) => !v)}
            aria-expanded={showImageUpload}
            aria-label="Toggle image palette extractor"
            title="Extract palette from an image"
          >
            From image
          </button>
          <button
            type="button"
            className={`copy-btn${showExport ? " copy-btn--active" : ""}`}
            onClick={() => setShowExport((v) => !v)}
            aria-expanded={showExport}
            aria-label="Toggle export panel"
          >
            Export
          </button>
        </div>
      </div>
    </section>
  );
}
