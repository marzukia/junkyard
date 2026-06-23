/**
 * ExportBar — a sticky footer bar that keeps the Download action always reachable.
 *
 * On desktop the sidebar already shows Export controls, so the bar is intentionally
 * compact. On mobile (single-column layout, sidebar below canvas) it becomes the
 * primary export call-to-action that's visible without scrolling.
 *
 * The bar registers its triggerExport callback via onRegisterTrigger so the
 * parent App can wire Cmd/Ctrl+Enter to it.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ASPECT_PRESETS } from "../lib/aspectRatios";
import { downloadBlob, exportFreeform, exportGrid } from "../lib/canvasExport";
import type { GridCellState } from "../lib/canvasExport";
import { exportFilename } from "../lib/exportFilename";
import { LAYOUT_TEMPLATES } from "../lib/layouts";
import { useCollageStore } from "../store/collageStore";

interface ExportBarProps {
  /** App calls this with a stable ref to trigger export from a keyboard shortcut. */
  onRegisterTrigger: (fn: () => void) => void;
}

export function ExportBar({ onRegisterTrigger }: ExportBarProps) {
  const {
    mode,
    templateId,
    cells,
    aspectId,
    gutter,
    radius,
    background,
    collageShape,
    borderWidth,
    borderColor,
    freeformCards,
  } = useCollageStore();

  const [exporting, setExporting] = useState(false);
  const [flash, setFlash] = useState(false);

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

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await buildBlob("png");
      downloadBlob(blob, exportFilename("png"));
      setFlash(true);
      setTimeout(() => setFlash(false), 1400);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [exporting, buildBlob]);

  // Register the export trigger so the parent can wire Cmd/Ctrl+Enter to it.
  const handleExportRef = useRef(handleExport);
  handleExportRef.current = handleExport;
  useEffect(() => {
    onRegisterTrigger(() => handleExportRef.current());
  }, [onRegisterTrigger]);

  return (
    <div className="export-bar" aria-label="Export collage">
      <span className="export-bar-meta mono-label">
        {currentAspect.exportWidth} x {currentAspect.exportHeight}px
      </span>
      <button
        type="button"
        className={`btn-accent export-bar-btn${flash ? " export-bar-btn--flash" : ""}`}
        onClick={handleExport}
        disabled={exporting}
        aria-busy={exporting}
        title="Download collage (Cmd/Ctrl+Enter)"
      >
        {exporting ? "Rendering..." : flash ? "Downloaded!" : "Download PNG"}
      </button>
      <kbd className="export-bar-kbd" aria-label="Keyboard shortcut">
        {typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "Cmd" : "Ctrl"}+Enter
      </kbd>
    </div>
  );
}
