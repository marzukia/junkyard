/**
 * ControlPanel — side panel with global collage controls:
 * layout picker, aspect ratio, gutter, radius, background, export.
 */
import { Slider } from "@mantine/core";
import { useCallback, useState } from "react";
import { ASPECT_PRESETS } from "../lib/aspectRatios";
import { downloadBlob, exportFreeform, exportGrid } from "../lib/canvasExport";
import type { GridCellState } from "../lib/canvasExport";
import { COLLAGE_SHAPES } from "../lib/collageShapes";
import { exportFilename } from "../lib/exportFilename";
import { LAYOUT_TEMPLATES } from "../lib/layouts";
import { useCollageStore } from "../store/collageStore";

const BG_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Transparent", value: "transparent" },
  { label: "Teal", value: "#2f9d8d" },
  { label: "Amber", value: "#e8b04b" },
  { label: "Coral", value: "#d9594c" },
];

export function ControlPanel() {
  const {
    mode,
    templateId,
    setTemplateId,
    cells,
    aspectId,
    setAspectId,
    gutter,
    setGutter,
    radius,
    setRadius,
    background,
    setBackground,
    collageShape,
    setCollageShape,
    borderWidth,
    setBorderWidth,
    borderColor,
    setBorderColor,
    freeformCards,
  } = useCollageStore();

  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [exportError, setExportError] = useState<string | null>(null);

  const currentAspect = ASPECT_PRESETS.find((p) => p.id === aspectId) ?? ASPECT_PRESETS[0];
  const currentTemplate = LAYOUT_TEMPLATES.find((t) => t.id === templateId) ?? LAYOUT_TEMPLATES[0];

  const buildBlob = useCallback(
    async (fmt: "png" | "jpg"): Promise<Blob> => {
      const { exportWidth, exportHeight } = currentAspect;
      const scale = exportWidth / 800;
      const exportGutter = Math.round(gutter * scale);
      const exportRadius = Math.round(radius * scale);
      const exportBorderWidth = Math.round(borderWidth * scale);

      if (mode === "grid") {
        const gridCells: GridCellState[] = currentTemplate.cells.map((rect, i) => ({
          rect,
          photoUrl: cells[i]?.photoUrl ?? null,
          panX: cells[i]?.panX ?? 0,
          panY: cells[i]?.panY ?? 0,
          zoom: cells[i]?.zoom ?? 1,
        }));
        return exportGrid({
          cells: gridCells,
          exportWidth,
          exportHeight,
          gutter: exportGutter,
          radius: exportRadius,
          background,
          collageShape,
          format: fmt,
          borderWidth: exportBorderWidth,
          borderColor,
        });
      }
      return exportFreeform({
        cards: freeformCards,
        exportWidth,
        exportHeight,
        background,
        collageShape,
        format: fmt,
      });
    },
    [
      currentAspect,
      gutter,
      radius,
      borderWidth,
      borderColor,
      mode,
      currentTemplate,
      cells,
      background,
      collageShape,
      freeformCards,
    ]
  );

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await buildBlob(exportFormat);
      downloadBlob(blob, exportFilename(exportFormat));
    } catch (err) {
      console.error("Export failed:", err);
      setExportError(`Download failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyImage = async () => {
    if (copying) return;
    setCopying(true);
    try {
      // Clipboard API requires PNG; fall back to a link download on unsupported browsers
      const blob = await buildBlob("png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1800);
    } catch (err) {
      console.error("Copy failed:", err);
    } finally {
      setCopying(false);
    }
  };

  const canCopyImage =
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard !== "undefined" &&
    typeof ClipboardItem !== "undefined";

  return (
    <div className="control-panel">
      {/* Aspect ratio */}
      <div className="card">
        <span className="mono-label">Aspect ratio</span>
        <div className="pill-group" style={{ marginTop: "0.75rem" }}>
          {ASPECT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pill-btn${aspectId === p.id ? " pill-btn--active" : ""}`}
              onClick={() => setAspectId(p.id)}
              aria-pressed={aspectId === p.id}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout (grid mode only) */}
      {mode === "grid" && (
        <div className="card">
          <span className="mono-label">Layout</span>
          <div className="layout-grid" style={{ marginTop: "0.75rem" }}>
            {LAYOUT_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`layout-btn${templateId === t.id ? " layout-btn--active" : ""}`}
                onClick={() => setTemplateId(t.id)}
                aria-pressed={templateId === t.id}
                title={t.description}
              >
                <LayoutPreview template={t} />
                <span className="layout-btn-label">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gutter + radius */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div className="control-group">
          <label className="control-label" htmlFor="gutter-slider">
            Spacing
            <span className="control-value">{gutter}px</span>
          </label>
          <div className="slider-wrap">
            <Slider
              id="gutter-slider"
              min={0}
              max={40}
              step={2}
              value={gutter}
              onChange={setGutter}
              aria-label="Cell gutter spacing"
            />
          </div>
        </div>

        {mode === "grid" && (
          <div className="control-group">
            <label className="control-label" htmlFor="radius-slider">
              Corner radius
              <span className="control-value">{radius}px</span>
            </label>
            <div className="slider-wrap">
              <Slider
                id="radius-slider"
                min={0}
                max={64}
                step={4}
                value={radius}
                onChange={setRadius}
                aria-label="Cell corner radius"
              />
            </div>
          </div>
        )}

        {mode === "grid" && (
          <div className="control-group">
            <label className="control-label" htmlFor="border-slider">
              Border width
              <span className="control-value">{borderWidth}px</span>
            </label>
            <div className="slider-wrap">
              <Slider
                id="border-slider"
                min={0}
                max={12}
                step={1}
                value={borderWidth}
                onChange={setBorderWidth}
                aria-label="Cell border width"
              />
            </div>
            {borderWidth > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.35rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--ink-faint)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  Color
                </span>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="bg-color-input"
                  aria-label="Border colour"
                  title="Border colour"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Background */}
      <div className="card">
        <span className="mono-label">Background</span>
        <div className="bg-presets" style={{ marginTop: "0.75rem" }}>
          {BG_PRESETS.map((bg) => (
            <button
              key={bg.value}
              type="button"
              className={`bg-swatch${background === bg.value ? " bg-swatch--active" : ""}`}
              onClick={() => setBackground(bg.value)}
              aria-label={bg.label}
              aria-pressed={background === bg.value}
              title={bg.label}
              style={{
                background:
                  bg.value === "transparent"
                    ? "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 10px 10px"
                    : bg.value,
              }}
            />
          ))}
          <input
            type="color"
            value={background === "transparent" ? "#ffffff" : background}
            onChange={(e) => setBackground(e.target.value)}
            className="bg-color-input"
            aria-label="Custom background colour"
            title="Custom colour"
          />
        </div>
      </div>

      {/* Shape */}
      <div className="card">
        <span className="mono-label">Shape</span>
        <div className="shape-picker" style={{ marginTop: "0.75rem" }}>
          {COLLAGE_SHAPES.map((shape) => (
            <button
              key={shape.id}
              type="button"
              className={`shape-btn${collageShape === shape.id ? " shape-btn--active" : ""}`}
              onClick={() => setCollageShape(shape.id)}
              aria-pressed={collageShape === shape.id}
              title={shape.label}
              data-testid={`shape-btn-${shape.id}`}
            >
              <ShapeIcon shapeId={shape.id} />
              <span className="shape-btn-label">{shape.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="card">
        <span className="mono-label">Export</span>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <div className="space-toggle">
            <button
              type="button"
              className={`space-btn${exportFormat === "png" ? " space-btn--active" : ""}`}
              onClick={() => setExportFormat("png")}
              aria-pressed={exportFormat === "png"}
            >
              PNG
            </button>
            <button
              type="button"
              className={`space-btn${exportFormat === "jpg" ? " space-btn--active" : ""}`}
              onClick={() => setExportFormat("jpg")}
              aria-pressed={exportFormat === "jpg"}
            >
              JPG
            </button>
          </div>
          <button
            type="button"
            className="btn-accent"
            onClick={handleExport}
            disabled={exporting}
            aria-busy={exporting}
          >
            {exporting ? "Rendering…" : "Download"}
          </button>
          {canCopyImage && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCopyImage}
              disabled={copying}
              aria-busy={copying}
              aria-label="Copy image to clipboard"
              style={
                copyFlash ? { color: "var(--accent)", borderColor: "var(--accent)" } : undefined
              }
            >
              {copyFlash ? "Copied!" : copying ? "Copying…" : "Copy image"}
            </button>
          )}
        </div>
        {exportError && (
          <p
            role="alert"
            aria-live="polite"
            style={{
              fontSize: "0.72rem",
              color: "var(--error, #c0392b)",
              marginTop: "0.5rem",
              fontFamily: "var(--font-mono)",
            }}
          >
            {exportError}
          </p>
        )}
        <p
          style={{
            fontSize: "0.68rem",
            color: "var(--ink-faint)",
            marginTop: "0.6rem",
            fontFamily: "var(--font-mono)",
          }}
        >
          {currentAspect.exportWidth} × {currentAspect.exportHeight}px
        </p>
      </div>
    </div>
  );
}

/** Mini SVG preview of a layout template */
function LayoutPreview({ template }: { template: (typeof LAYOUT_TEMPLATES)[number] }) {
  return (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      {template.cells.map((rect, i) => (
        <rect
          key={`${template.id}-${i}`}
          x={rect.x * 40 + 1}
          y={rect.y * 40 + 1}
          width={rect.w * 40 - 2}
          height={rect.h * 40 - 2}
          rx="2"
          fill="currentColor"
          opacity="0.7"
        />
      ))}
    </svg>
  );
}

/** Mini shape icon for the shape picker */
function ShapeIcon({ shapeId }: { shapeId: string }) {
  const S = 28;
  const pad = 3;
  const w = S - pad * 2;
  const h = S - pad * 2;
  const cx = S / 2;
  const cy = S / 2;

  if (shapeId === "rectangle") {
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <rect x={pad} y={pad} width={w} height={h} fill="currentColor" opacity="0.8" />
      </svg>
    );
  }
  if (shapeId === "rounded") {
    const r = w * 0.15;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <rect x={pad} y={pad} width={w} height={h} rx={r} fill="currentColor" opacity="0.8" />
      </svg>
    );
  }
  if (shapeId === "circle") {
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <ellipse cx={cx} cy={cy} rx={w / 2} ry={h / 2} fill="currentColor" opacity="0.8" />
      </svg>
    );
  }
  if (shapeId === "heart") {
    // Scaled heart path for the icon
    const hw = w;
    const hh = h;
    const ox = pad;
    const oy = pad;
    function pt(nx: number, ny: number) {
      return `${ox + nx * hw},${oy + ny * hh}`;
    }
    const d =
      `M${pt(0.5, 1.0)} ` +
      `C${pt(0.1, 0.75)} ${pt(0.0, 0.45)} ${pt(0.0, 0.3)} ` +
      `C${pt(0.0, 0.12)} ${pt(0.15, 0.0)} ${pt(0.3, 0.0)} ` +
      `C${pt(0.4, 0.0)} ${pt(0.5, 0.1)} ${pt(0.5, 0.2)} ` +
      `C${pt(0.5, 0.1)} ${pt(0.6, 0.0)} ${pt(0.7, 0.0)} ` +
      `C${pt(0.85, 0.0)} ${pt(1.0, 0.12)} ${pt(1.0, 0.3)} ` +
      `C${pt(1.0, 0.45)} ${pt(0.9, 0.75)} ${pt(0.5, 1.0)} Z`;
    return (
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true">
        <path d={d} fill="currentColor" opacity="0.8" />
      </svg>
    );
  }
  return null;
}
