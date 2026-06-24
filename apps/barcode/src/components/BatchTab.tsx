/**
 * BatchTab -- paste a list of values, generate a grid of barcodes, download as ZIP.
 *
 * Kept in its own file so the main App.tsx and barcode-rendering logic
 * stay readable. Batch shares FORMAT_META for validation but renders
 * barcodes synchronously into hidden SVG elements rather than through
 * the live preview loop.
 *
 * Scope note: Data Matrix is not client-side feasible with jsbarcode
 * (no support) without a heavy extra dep. Deferred -- see PR notes.
 */

import JsBarcode from "jsbarcode";
import JSZip from "jszip";
import { useCallback, useMemo, useRef, useState } from "react";
import { FORMAT_META, FORMAT_ORDER } from "../lib/barcode";
import type { BarcodeFormat } from "../lib/barcode";

interface BatchItem {
  value: string;
  valid: boolean;
  error: string | null;
}

function parseBatchInput(raw: string, format: BarcodeFormat): BatchItem[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((value) => {
      const error = FORMAT_META[format].validate(value);
      return { value, valid: error === null, error };
    });
}

/** Render one barcode value into an off-screen SVG and return the SVG element. */
function renderSvgOffscreen(value: string, format: BarcodeFormat): SVGSVGElement | null {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, value, {
      format,
      width: 2,
      height: 80,
      margin: 10,
      displayValue: true,
      lineColor: "#1a2530",
      background: "#ffffff",
      font: "Inter, system-ui, sans-serif",
      fontSize: 12,
      textMargin: 4,
    });
    return svg;
  } catch {
    return null;
  }
}

function svgToPngBlob(svg: SVGSVGElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = svg.viewBox.baseVal.width || 300;
      canvas.height = svg.viewBox.baseVal.height || 120;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

// ── Preview grid item ─────────────────────────────────────────────────────

function BatchPreviewItem({ item, format }: { item: BatchItem; format: BarcodeFormat }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [rendered, setRendered] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);

  // render into the ref on mount
  const refCallback = useCallback(
    (el: SVGSVGElement | null) => {
      if (!el || !item.valid) return;
      try {
        JsBarcode(el, item.value, {
          format,
          width: 2,
          height: 60,
          margin: 8,
          displayValue: true,
          lineColor: "#1a2530",
          background: "#ffffff",
          font: "Inter, system-ui, sans-serif",
          fontSize: 11,
          textMargin: 3,
        });
        setRendered(true);
      } catch {
        setRenderFailed(true);
      }
      // store for possible future use
      if (svgRef) (svgRef as React.MutableRefObject<SVGSVGElement | null>).current = el;
    },
    [item.value, item.valid, format]
  );

  return (
    <div className={`batch-item${item.valid ? "" : " batch-item--invalid"}`}>
      {item.valid && !renderFailed && (
        <svg
          ref={refCallback as unknown as React.Ref<SVGSVGElement>}
          className={`bc-svg${rendered ? " bc-svg--visible" : ""}`}
          aria-label={`Barcode for ${item.value}`}
        />
      )}
      {(!item.valid || renderFailed) && (
        <span className="batch-item-error" title={item.error ?? "Render failed"}>
          {item.value}
          <span className="bc-error-icon"> !</span>
        </span>
      )}
    </div>
  );
}

// ── Main BatchTab ─────────────────────────────────────────────────────────

export function BatchTab() {
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [rawInput, setRawInput] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const items = useMemo(() => parseBatchInput(rawInput, format), [rawInput, format]);
  const validItems = items.filter((i) => i.valid);
  const hasItems = items.length > 0;

  const handleDownloadZip = useCallback(async () => {
    if (validItems.length === 0) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const zip = new JSZip();
      const folder = zip.folder("barcodes");
      if (!folder) throw new Error("Could not create zip folder");

      await Promise.all(
        validItems.map(async (item, i) => {
          const svg = renderSvgOffscreen(item.value, format);
          if (!svg) return;
          const blob = await svgToPngBlob(svg);
          if (!blob) return;
          const safe = item.value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
          folder.file(`${String(i + 1).padStart(3, "0")}_${safe}.png`, blob);
        })
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barcodes-${format.toLowerCase()}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }, [validItems, format]);

  return (
    <div className="bc-layout batch-layout">
      {/* ── Controls ── */}
      <div className="card bc-controls-card">
        <div className="bc-section">
          <div className="space-toggle-wrapper" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            <span className="space-toggle-label">Format</span>
            <div className="space-toggle" role="group" aria-label="Batch barcode format">
              {FORMAT_ORDER.map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`space-btn${format === fmt ? " space-btn--active" : ""}`}
                  onClick={() => setFormat(fmt)}
                  aria-pressed={format === fmt}
                >
                  {FORMAT_META[fmt].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bc-section">
          <label className="bc-input-label" htmlFor="batch-input">
            <span className="mono-label">Values</span>
            <span className="bc-format-hint">
              One value per line (or comma-separated). {FORMAT_META[format].description}
            </span>
          </label>
          <textarea
            id="batch-input"
            className="bc-input qr-textarea batch-textarea"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder={`${FORMAT_META[format].placeholder}\n${FORMAT_META[format].placeholder.split("").reverse().join("").slice(0, 8)}...`}
            rows={8}
            spellCheck={false}
            autoComplete="off"
            aria-label="Batch barcode values"
          />
        </div>

        {hasItems && (
          <div className="bc-section">
            <p className="bc-format-hint">
              {validItems.length} valid / {items.length - validItems.length} invalid
            </p>
          </div>
        )}

        <div className="bc-section">
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownloadZip}
            disabled={validItems.length === 0 || downloading}
            aria-label="Download all barcodes as ZIP"
          >
            {downloading
              ? "Generating..."
              : `Download ${validItems.length > 0 ? validItems.length : ""} PNG as ZIP`}
          </button>
          {downloadError && (
            <p className="bc-error" role="alert">
              <span className="bc-error-icon">!</span>
              {downloadError}
            </p>
          )}
        </div>
      </div>

      {/* ── Preview grid ── */}
      <div className="card bc-preview-card">
        <div className="bc-preview-header">
          <span className="mono-label">Preview</span>
          {hasItems && (
            <span className="bc-format-hint">
              {validItems.length} of {items.length} items shown
            </span>
          )}
        </div>
        <div className="batch-grid" aria-label="Batch barcode preview">
          {!hasItems && (
            <div className="bc-empty">
              <p className="bc-empty-text">
                Paste a list of values to generate a batch of barcodes.
              </p>
            </div>
          )}
          {items.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: order is stable
            <BatchPreviewItem key={i} item={item} format={format} />
          ))}
        </div>
      </div>
    </div>
  );
}
