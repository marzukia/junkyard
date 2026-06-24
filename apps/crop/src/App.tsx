import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { CropCanvas } from "./components/CropCanvas";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  ASPECT_PRESETS,
  SOCIAL_PRESETS,
  applyCropAndResizeWithShape,
  fitRectToAspect,
  flipCanvas,
  proportionalHeight,
  rotateCanvas,
  rotateCanvasArbitrary,
} from "./crop";
import type { AspectPreset, CropRect, CropShape, ExportFormat } from "./crop";
import { useCropStore } from "./store";

const FORMATS: ExportFormat[] = ["png", "jpg", "webp"];
const ACCEPTED =
  "image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp";

export function App() {
  const store = useCropStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resizeWStr, setResizeWStr] = useState("");
  const [resizeHStr, setResizeHStr] = useState("");
  const [socialOpen, setSocialOpen] = useState(false);

  // Keyboard undo/redo and Cmd+Enter export
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        store.redo();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (store.imageUrl && store.crop.w > 0 && !processing) {
          handleExport();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, processing]);

  const loadFile = useCallback(
    (file: File) => {
      setLoadError(null);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        store.loadImage(file, url, img.naturalWidth, img.naturalHeight);
        setResizeWStr("");
        setResizeHStr("");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setLoadError(`Could not load "${file.name}" as an image.`);
      };
      img.src = url;
    },
    [store]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setLoadError("Drop an image file (JPEG, PNG, WebP, …).");
        return;
      }
      loadFile(file);
    },
    [loadFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setLoadError("Please select an image file (JPEG, PNG, WebP, …).");
      } else {
        loadFile(file);
      }
    }
    e.target.value = "";
  };

  const handleCropCommit = useCallback(
    (rect: CropRect) => {
      store.setCropWithHistory(rect);
    },
    [store]
  );

  const handleAspectChange = (preset: AspectPreset) => {
    store.setAspect(preset);
    if (preset !== "free" && store.imageW > 0) {
      const ar = ASPECT_PRESETS.find((a) => a.label === preset);
      if (ar) {
        const newCrop = fitRectToAspect(ar, store.imageW, store.imageH);
        store.setCrop(newCrop);
      }
    }
  };

  const handleSocialPreset = (idx: number) => {
    const preset = SOCIAL_PRESETS[idx];
    if (!preset) return;
    setSocialOpen(false);
    handleAspectChange(preset.aspect);
  };

  const handleResizeWChange = (val: string) => {
    setResizeWStr(val);
    const n = Number.parseInt(val, 10);
    if (!Number.isNaN(n) && n > 0) {
      store.setResizeW(n);
      if (store.resizeLocked && store.crop.w > 0) {
        const h = proportionalHeight(store.crop.w, store.crop.h, n);
        store.setResizeH(h);
        setResizeHStr(String(h));
      }
    } else {
      store.setResizeW(0);
    }
  };

  const handleResizeHChange = (val: string) => {
    setResizeHStr(val);
    const n = Number.parseInt(val, 10);
    if (!Number.isNaN(n) && n > 0) {
      store.setResizeH(n);
      if (store.resizeLocked && store.crop.h > 0) {
        const w = proportionalHeight(store.crop.h, store.crop.w, n);
        store.setResizeW(w);
        setResizeWStr(String(w));
      }
    } else {
      store.setResizeH(0);
    }
  };

  const handleExport = useCallback(async () => {
    if (!store.imageUrl || !store.file) return;
    setProcessing(true);
    setExportError(null);
    try {
      // Build a canvas with the source image
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = store.imageUrl ?? "";
      });
      let canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(img, 0, 0);

      // Apply straighten (arbitrary angle) first, before 90-degree rotations
      if (store.straighten !== 0) {
        canvas = rotateCanvasArbitrary(canvas, store.straighten);
      }

      // Apply rotation. rotateCanvas accepts 90 | -90 | 180; 270 is equivalent to -90.
      if (store.rotation !== 0) {
        const deg = (store.rotation === 270 ? -90 : store.rotation) as 90 | -90 | 180;
        canvas = rotateCanvas(canvas, deg);
      }

      // Apply flip
      if (store.flipH || store.flipV) {
        canvas = flipCanvas(canvas, store.flipH, store.flipV);
      }

      // Compute effective crop on potentially-rotated canvas
      // Rotation swaps w/h in pairs of 90/270
      let effectiveCrop = { ...store.crop };
      const isSwapped = store.rotation === 90 || store.rotation === 270;
      if (isSwapped) {
        // After rotation, the canvas is imageH x imageW
        // Map the original-image crop coords to the rotated canvas
        const origW = store.imageW;
        const origH = store.imageH;
        if (store.rotation === 90) {
          effectiveCrop = {
            x: store.crop.y,
            y: origW - store.crop.x - store.crop.w,
            w: store.crop.h,
            h: store.crop.w,
          };
        } else {
          // 270
          effectiveCrop = {
            x: origH - store.crop.y - store.crop.h,
            y: store.crop.x,
            w: store.crop.h,
            h: store.crop.w,
          };
        }
      } else if (store.rotation === 180) {
        effectiveCrop = {
          x: store.imageW - store.crop.x - store.crop.w,
          y: store.imageH - store.crop.y - store.crop.h,
          w: store.crop.w,
          h: store.crop.h,
        };
      }

      // For flips, adjust coords
      if (store.flipH) {
        effectiveCrop = {
          ...effectiveCrop,
          x: canvas.width - effectiveCrop.x - effectiveCrop.w,
        };
      }
      if (store.flipV) {
        effectiveCrop = {
          ...effectiveCrop,
          y: canvas.height - effectiveCrop.y - effectiveCrop.h,
        };
      }

      // Clamp crop to canvas bounds (straighten expands canvas, crop stays valid)
      effectiveCrop = {
        x: Math.max(0, Math.min(effectiveCrop.x, canvas.width - 1)),
        y: Math.max(0, Math.min(effectiveCrop.y, canvas.height - 1)),
        w: Math.min(effectiveCrop.w, canvas.width - effectiveCrop.x),
        h: Math.min(effectiveCrop.h, canvas.height - effectiveCrop.y),
      };

      const dataUrl = applyCropAndResizeWithShape(
        canvas,
        effectiveCrop,
        store.resizeW,
        store.resizeH,
        store.format,
        store.quality,
        store.cropShape
      );

      // Circle crop forces PNG
      const effectiveFmt = store.cropShape === "circle" ? "png" : store.format;
      const ext = effectiveFmt === "jpg" ? "jpg" : effectiveFmt;
      const baseName = store.file.name.replace(/\.[^.]+$/, "");
      const shapeSuffix = store.cropShape === "circle" ? "-circle" : "-crop";
      const outName = `${baseName}${shapeSuffix}.${ext}`;
      store.setResult(dataUrl, outName);
    } catch (err) {
      setExportError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProcessing(false);
    }
  }, [store]);

  const handleCopyImage = useCallback(async () => {
    if (!store.resultUrl) return;
    setCopying(true);
    try {
      // Convert data URL to blob for ClipboardItem
      const res = await fetch(store.resultUrl);
      const blob = await res.blob();
      // Use PNG for clipboard compatibility
      let clipBlob = blob;
      if (!blob.type.includes("png")) {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement("canvas");
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          clipBlob = await new Promise<Blob>((res) =>
            c.toBlob((b) => {
              if (b) res(b);
            }, "image/png")
          );
        }
      }
      await navigator.clipboard.write([new ClipboardItem({ "image/png": clipBlob })]);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 1800);
    } catch {
      // Clipboard write may be blocked in non-secure contexts
    } finally {
      setCopying(false);
    }
  }, [store.resultUrl]);

  const hasImage = !!store.imageUrl;
  const cropInfo =
    store.crop.w > 0 && store.crop.h > 0 ? `${store.crop.w} x ${store.crop.h} px` : "";

  return (
    <div className="app-root">
      <Header
        title="Crop"
        subtitle="crop, rotate, flip and resize images - no upload, no account"
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        {/* Drop zone (shown when no image loaded) */}
        {!hasImage && (
          <label
            className={`drop-zone${dragging ? " drop-zone--active" : ""}`}
            aria-label="Drop an image here or click to select"
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
          >
            <UploadIcon />
            <span className="drop-zone-title">Drop an image here or click to select</span>
            <span className="drop-zone-sub">
              JPG · PNG · WebP · GIF · BMP · runs in your browser
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              onChange={onInputChange}
              style={{ display: "none" }}
            />
          </label>
        )}

        {loadError && (
          <p
            role="alert"
            aria-live="assertive"
            style={{
              color: "var(--error, #c0392b)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              margin: "0.75rem 0",
            }}
          >
            {loadError}
          </p>
        )}

        {hasImage && (
          <>
            {/* Canvas */}
            <div className="card" style={{ padding: "1rem" }}>
              <CropCanvas
                imageUrl={store.imageUrl ?? ""}
                imageW={store.imageW}
                imageH={store.imageH}
                crop={store.crop}
                aspect={store.aspect}
                rotation={store.rotation}
                flipH={store.flipH}
                flipV={store.flipV}
                straighten={store.straighten}
                cropShape={store.cropShape}
                onChange={store.setCrop}
                onCommit={handleCropCommit}
              />
              <div className="canvas-footer-bar">
                {cropInfo && (
                  <div className="crop-info-bar" style={{ flex: 1 }}>
                    <span className="mono-label">crop</span>
                    <span className="crop-dims">{cropInfo}</span>
                    {store.straighten !== 0 && (
                      <span className="crop-dims" style={{ color: "var(--accent)" }}>
                        {store.straighten > 0 ? "+" : ""}
                        {store.straighten.toFixed(1)}deg
                      </span>
                    )}
                  </div>
                )}
                {/* Sticky export shortcut adjacent to canvas */}
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleExport}
                  disabled={processing || store.crop.w === 0}
                  aria-busy={processing}
                  title="Export image (Cmd+Enter)"
                  style={{ flexShrink: 0 }}
                >
                  {processing ? "Processing..." : "Export"}
                </button>
              </div>
            </div>

            {/* Controls row */}
            <div className="card">
              <div className="crop-controls-grid">
                {/* Aspect */}
                <div className="control-group">
                  <div className="control-group-header">
                    <span className="mono-label">Aspect ratio</span>
                    {/* Social presets dropdown */}
                    <div className="social-dropdown-wrap">
                      <button
                        type="button"
                        className="btn-secondary btn-secondary--sm"
                        onClick={() => setSocialOpen((v) => !v)}
                        aria-expanded={socialOpen}
                        aria-haspopup="menu"
                      >
                        <SocialIcon />
                        Social sizes
                      </button>
                      {socialOpen && (
                        <ul
                          className="social-dropdown"
                          role="menu"
                          aria-label="Social size presets"
                        >
                          {SOCIAL_PRESETS.map((p, i) => (
                            <li key={p.name}>
                              <button
                                type="button"
                                className="social-dropdown-item"
                                onClick={() => handleSocialPreset(i)}
                                role="menuitem"
                              >
                                <span className="social-name">{p.name}</span>
                                <span className="social-dims">{p.px}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <fieldset
                    className="format-toggle"
                    aria-label="Aspect ratio"
                    style={{ border: "none", padding: 0, margin: 0 }}
                  >
                    {ASPECT_PRESETS.map((ap) => (
                      <button
                        key={ap.label}
                        type="button"
                        className={`format-btn${store.aspect === ap.label ? " format-btn--active" : ""}`}
                        onClick={() => handleAspectChange(ap.label)}
                        aria-pressed={store.aspect === ap.label}
                      >
                        {ap.label}
                      </button>
                    ))}
                  </fieldset>
                </div>

                {/* Transform */}
                <div className="control-group">
                  <span className="mono-label">Transform</span>
                  <div className="transform-row">
                    <div className="transform-btn-wrap">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={store.rotateLeft}
                        title="Rotate 90 deg left"
                        aria-label="Rotate left"
                      >
                        <RotateLeftIcon />
                      </button>
                      <span className="transform-label">Rotate L</span>
                    </div>
                    <div className="transform-btn-wrap">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={store.rotateRight}
                        title="Rotate 90 deg right"
                        aria-label="Rotate right"
                      >
                        <RotateRightIcon />
                      </button>
                      <span className="transform-label">Rotate R</span>
                    </div>
                    <div className="transform-btn-wrap">
                      <button
                        type="button"
                        className={`btn-icon${store.flipH ? " btn-icon--active" : ""}`}
                        onClick={store.toggleFlipH}
                        title="Flip horizontal"
                        aria-label="Flip horizontal"
                        aria-pressed={store.flipH}
                      >
                        <FlipHIcon />
                      </button>
                      <span className="transform-label">Flip H</span>
                    </div>
                    <div className="transform-btn-wrap">
                      <button
                        type="button"
                        className={`btn-icon${store.flipV ? " btn-icon--active" : ""}`}
                        onClick={store.toggleFlipV}
                        title="Flip vertical"
                        aria-label="Flip vertical"
                        aria-pressed={store.flipV}
                      >
                        <FlipVIcon />
                      </button>
                      <span className="transform-label">Flip V</span>
                    </div>
                  </div>
                </div>

                {/* Straighten slider */}
                <div className="control-group">
                  <label className="control-label" htmlFor="straighten-range">
                    Straighten
                    <span className="control-value">
                      {store.straighten > 0 ? "+" : ""}
                      {store.straighten.toFixed(1)}&deg;
                    </span>
                    {store.straighten !== 0 && (
                      <button
                        type="button"
                        className="btn-reset-inline"
                        onClick={() => store.setStraighten(0)}
                        aria-label="Reset straighten to 0"
                      >
                        reset
                      </button>
                    )}
                  </label>
                  <input
                    id="straighten-range"
                    type="range"
                    min={-45}
                    max={45}
                    step={0.5}
                    value={store.straighten}
                    onChange={(e) => store.setStraighten(Number(e.target.value))}
                    className="quality-range"
                    aria-label={`Straighten ${store.straighten} degrees`}
                  />
                </div>

                {/* Crop shape */}
                <div className="control-group">
                  <span className="mono-label">Crop shape</span>
                  <fieldset
                    className="format-toggle"
                    aria-label="Crop shape"
                    style={{ border: "none", padding: 0, margin: 0 }}
                  >
                    {(["rect", "circle"] as CropShape[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`format-btn${store.cropShape === s ? " format-btn--active" : ""}`}
                        onClick={() => store.setCropShape(s)}
                        aria-pressed={store.cropShape === s}
                        title={
                          s === "circle"
                            ? "Circle/ellipse crop outputs transparent PNG"
                            : "Standard rectangular crop"
                        }
                      >
                        {s === "rect" ? "Rectangle" : "Circle"}
                      </button>
                    ))}
                  </fieldset>
                  {store.cropShape === "circle" && (
                    <span className="control-hint">
                      Outputs transparent PNG regardless of format
                    </span>
                  )}
                </div>

                {/* Resize */}
                <div className="control-group">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="mono-label">Resize output (px)</span>
                    <button
                      type="button"
                      className={`lock-btn${store.resizeLocked ? " lock-btn--active" : ""}`}
                      onClick={() => store.setResizeLocked(!store.resizeLocked)}
                      aria-pressed={store.resizeLocked}
                      title={store.resizeLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                      aria-label={store.resizeLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
                    >
                      {store.resizeLocked ? <LockIcon /> : <UnlockIcon />}
                    </button>
                  </div>
                  <div className="resize-inputs">
                    <div className="resize-field">
                      <label className="resize-field-label" htmlFor="resize-w">
                        W
                      </label>
                      <input
                        id="resize-w"
                        type="number"
                        min={1}
                        max={16000}
                        placeholder={store.crop.w > 0 ? String(store.crop.w) : "auto"}
                        value={resizeWStr}
                        onChange={(e) => handleResizeWChange(e.target.value)}
                        className="resize-input"
                        aria-label="Output width in pixels"
                      />
                    </div>
                    <span className="resize-x">x</span>
                    <div className="resize-field">
                      <label className="resize-field-label" htmlFor="resize-h">
                        H
                      </label>
                      <input
                        id="resize-h"
                        type="number"
                        min={1}
                        max={16000}
                        placeholder={store.crop.h > 0 ? String(store.crop.h) : "auto"}
                        value={resizeHStr}
                        onChange={(e) => handleResizeHChange(e.target.value)}
                        className="resize-input"
                        aria-label="Output height in pixels"
                      />
                    </div>
                  </div>
                </div>

                {/* Export format + quality */}
                <div className="control-group">
                  <span className="mono-label">Export format</span>
                  <fieldset
                    className="format-toggle"
                    aria-label="Export format"
                    style={{ border: "none", padding: 0, margin: 0 }}
                  >
                    {FORMATS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`format-btn${store.format === f ? " format-btn--active" : ""}${store.cropShape === "circle" && f !== "png" ? " format-btn--muted" : ""}`}
                        onClick={() => store.setFormat(f)}
                        aria-pressed={store.format === f}
                        title={
                          store.cropShape === "circle" && f !== "png"
                            ? "Circle crop always outputs PNG"
                            : undefined
                        }
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </fieldset>
                </div>

                {/* Quality slider (only for lossy, and not overridden by circle) */}
                {(store.format === "jpg" || store.format === "webp") &&
                  store.cropShape !== "circle" && (
                    <div className="control-group">
                      <label className="control-label" htmlFor="quality-range">
                        Quality
                        <span className="control-value">{store.quality}%</span>
                      </label>
                      <input
                        id="quality-range"
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={store.quality}
                        onChange={(e) => store.setQuality(Number(e.target.value))}
                        className="quality-range"
                        aria-label={`Export quality ${store.quality}%`}
                      />
                    </div>
                  )}
              </div>

              {exportError && (
                <p
                  role="alert"
                  aria-live="assertive"
                  style={{
                    color: "var(--error, #c0392b)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    marginTop: "1rem",
                  }}
                >
                  {exportError}
                </p>
              )}

              {/* Action bar */}
              <div className="action-bar" style={{ marginTop: "1.5rem" }}>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleExport}
                  disabled={processing || store.crop.w === 0}
                  aria-busy={processing}
                  title="Export image (Cmd/Ctrl+Enter)"
                >
                  {processing ? "Processing..." : "Export image"}
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={store.undo}
                  disabled={store.undoStack.length === 0}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <UndoIcon />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={store.redo}
                  disabled={store.redoStack.length === 0}
                  title="Redo (Ctrl+Shift+Z)"
                  aria-label="Redo"
                >
                  <RedoIcon />
                </button>
                <label
                  className="btn-secondary"
                  style={{ cursor: "pointer" }}
                  aria-label="Change image"
                >
                  Change image
                  <input
                    type="file"
                    accept={ACCEPTED}
                    onChange={onInputChange}
                    style={{ display: "none" }}
                  />
                </label>
                <div className="action-bar-right">
                  <button type="button" className="btn-secondary" onClick={store.reset}>
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Result */}
            {store.resultUrl && store.resultName && (
              <div className="card result-card">
                <div className="result-header">
                  <span className="mono-label">Result</span>
                  <div className="result-actions">
                    <button
                      type="button"
                      className={`file-download-btn${copyFlash ? " file-download-btn--copied" : ""}`}
                      onClick={handleCopyImage}
                      disabled={copying}
                      aria-label="Copy image to clipboard"
                    >
                      <CopyIcon />
                      {copyFlash ? "Copied!" : "Copy image"}
                    </button>
                    <a
                      href={store.resultUrl}
                      download={store.resultName}
                      className="file-download-btn"
                      aria-label={`Download ${store.resultName}`}
                    >
                      <DownloadIcon />
                      Save {store.resultName}
                    </a>
                  </div>
                </div>
                <img
                  src={store.resultUrl}
                  alt="Cropped result"
                  className={`result-preview${store.cropShape === "circle" ? " result-preview--circle" : ""}`}
                  id="result-preview"
                />
              </div>
            )}
          </>
        )}

        {!hasImage && (
          <p className="empty-hint">
            Your image is processed entirely in your browser. Nothing is uploaded.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no account." />
    </div>
  );
}

// Icons

function UploadIcon() {
  return (
    <svg
      className="drop-zone-icon"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function RotateLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function RotateRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

function FlipHIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" />
      <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 3" />
    </svg>
  );
}

function FlipVIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
      <path d="M21 16v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
      <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 3" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7v6h6" />
      <path d="M3 13C4.5 7.5 10 4 16 6a9 9 0 0 1 5 8" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 7v6h-6" />
      <path d="M21 13C19.5 7.5 14 4 8 6a9 9 0 0 0-5 8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function SocialIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
