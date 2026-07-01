import { BrandMark } from "@junkyardsh/kit";
import { Footer } from "@junkyardsh/kit";
import { Header } from "@junkyardsh/kit";
import { Slider } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND_SOLIDS, GRADIENT_PRESETS, SIZE_PRESETS, clamp, exportFilename } from "./beautifier";
import type { BeautifySettings, BgKind, ExportFormat, WindowFrameType } from "./beautifier";
import { renderToBlob, renderToDataUrl } from "./renderer";
import { useScreenshotStore } from "./store";

const ACCEPTED = "image/*";

export function App() {
  const {
    settings,
    sourceFile,
    sourceUrl,
    previewUrl,
    isRendering,
    bgObjectUrl,
    setSettings,
    setSourceFile,
    clearSource,
    setPreviewUrl,
    setIsRendering,
    setBgImage,
    clearBgImage,
  } = useScreenshotStore();

  const [dragging, setDragging] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const loadFile = useCallback(
    (file: File) => {
      setLoadError(null);
      const url = URL.createObjectURL(file);
      setSourceFile(file, url);
    },
    [setSourceFile]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        setLoadError("Please drop an image file (JPEG, PNG, WebP, …).");
        return;
      }
      loadFile(file);
    },
    [loadFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const onPaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) loadFile(file);
          break;
        }
      }
    },
    [loadFile]
  );

  useEffect(() => {
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onPaste]);

  // Keep bgImgRef in sync with bgObjectUrl
  useEffect(() => {
    if (!bgObjectUrl) {
      bgImgRef.current = null;
      return;
    }
    const bgImg = new Image();
    bgImg.onload = () => {
      bgImgRef.current = bgImg;
    };
    bgImg.src = bgObjectUrl;
  }, [bgObjectUrl]);

  // Re-render whenever source or settings change
  useEffect(() => {
    if (!sourceUrl) return;
    setIsRendering(true);
    const img = new Image();
    imgRef.current = img;
    img.onload = () => {
      try {
        const dataUrl = renderToDataUrl(img, settings, bgImgRef.current);
        setPreviewUrl(dataUrl);
      } catch {
        // Canvas may not be available in some test environments
      } finally {
        setIsRendering(false);
      }
    };
    img.onerror = () => {
      setIsRendering(false);
      setLoadError("Could not decode image. The file may be corrupted or an unsupported format.");
      clearSource();
    };
    img.src = sourceUrl;
  }, [sourceUrl, settings, setPreviewUrl, setIsRendering, clearSource]);

  const download = () => {
    if (!previewUrl || !sourceFile) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = exportFilename(sourceFile.name, settings.exportFormat);
    a.click();
  };

  const copyImage = useCallback(async () => {
    if (!sourceUrl || !imgRef.current) return;
    setCopyState("copying");
    try {
      const img = imgRef.current;
      const blob = await renderToBlob(img, { ...settings, exportFormat: "png" }, bgImgRef.current);
      if (!blob) throw new Error("Render produced no blob");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  }, [sourceUrl, settings]);

  // Cmd/Ctrl+Enter triggers copy (primary action) when an image is loaded
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (sourceUrl && previewUrl && !isRendering && copyState === "idle") {
          e.preventDefault();
          void copyImage();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sourceUrl, previewUrl, isRendering, copyState, copyImage]);

  return (
    <div className="app-root">
      <Header
        title="Screenshot"
        subtitle="beautify screenshots · backgrounds · shadows · frames · no upload"
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        {loadError && (
          <p
            role="alert"
            aria-live="assertive"
            style={{
              color: "var(--error, #c0392b)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              marginBottom: "1rem",
            }}
          >
            {loadError}
          </p>
        )}
        {!sourceUrl ? (
          <DropZone
            dragging={dragging}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onInputChange={(e) => handleFiles(e.target.files)}
            inputRef={inputRef}
            accepted={ACCEPTED}
          />
        ) : (
          <div className="editor-layout">
            {/* Preview panel */}
            <div className="card preview-card">
              <div className="preview-area" data-testid="preview-area">
                {isRendering && <div className="preview-spinner" aria-label="Rendering" />}
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt="Beautified screenshot preview"
                    className="preview-img"
                  />
                )}
              </div>
              <div className="preview-actions">
                <button
                  type="button"
                  className={`btn-accent${copyState === "copied" ? " btn-accent--success" : copyState === "error" ? " btn-accent--error" : ""}`}
                  onClick={copyImage}
                  disabled={!previewUrl || isRendering || copyState === "copying"}
                  data-testid="copy-image-btn"
                  title="Copy to clipboard (Cmd+Enter)"
                >
                  {copyState === "copied" ? (
                    <>
                      <CheckIcon /> Copied!
                    </>
                  ) : copyState === "error" ? (
                    "Copy failed"
                  ) : copyState === "copying" ? (
                    "Copying..."
                  ) : (
                    <>
                      <CopyIcon /> Copy image
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={download}
                  disabled={!previewUrl || isRendering}
                >
                  <DownloadIcon /> Save {settings.exportFormat.toUpperCase()}
                </button>
                <button type="button" className="btn-secondary" onClick={clearSource}>
                  Change image
                </button>
              </div>
              <p className="copy-hint">Cmd+Enter copies to clipboard</p>
            </div>

            {/* Controls panel */}
            <div className="controls-panel">
              <BgControls
                bgKind={settings.bgKind}
                gradientId={settings.gradientId}
                solidColor={settings.solidColor}
                brandId={settings.brandId}
                hasBgImage={!!bgObjectUrl}
                onChange={setSettings}
                onBgImageFile={setBgImage}
                onClearBgImage={clearBgImage}
              />

              <div className="card">
                <div className="controls-grid-2">
                  <SliderControl
                    id="padding-slider"
                    label="Padding"
                    value={settings.padding}
                    min={0}
                    max={200}
                    step={8}
                    unit="px"
                    onChange={(v) => setSettings({ padding: clamp(v, 0, 200) })}
                  />
                  <SliderControl
                    id="radius-slider"
                    label="Corner radius"
                    value={settings.cornerRadius}
                    min={0}
                    max={48}
                    step={2}
                    unit="px"
                    onChange={(v) => setSettings({ cornerRadius: clamp(v, 0, 48) })}
                  />
                  <div className="control-group">
                    <span className="mono-label">Drop shadow</span>
                    <fieldset
                      className="format-toggle"
                      aria-label="Shadow size"
                      style={{ border: "none", padding: 0, margin: 0 }}
                    >
                      {(["None", "Soft", "Medium", "Heavy"] as const).map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          className={`format-btn${settings.shadowSize === i ? " format-btn--active" : ""}`}
                          onClick={() => setSettings({ shadowSize: i })}
                          aria-pressed={settings.shadowSize === i}
                        >
                          {label}
                        </button>
                      ))}
                    </fieldset>
                  </div>
                  <div className="control-group">
                    <span className="mono-label">Window frame</span>
                    <fieldset
                      className="format-toggle"
                      aria-label="Window frame type"
                      style={{ border: "none", padding: 0, margin: 0 }}
                    >
                      {(
                        [
                          { id: "none", label: "None" },
                          { id: "macos", label: "macOS" },
                          { id: "browser", label: "Browser" },
                        ] as { id: WindowFrameType; label: string }[]
                      ).map(({ id, label }) => (
                        <button
                          key={id}
                          type="button"
                          className={`format-btn${settings.windowFrameType === id ? " format-btn--active" : ""}`}
                          onClick={() => setSettings({ windowFrameType: id })}
                          aria-pressed={settings.windowFrameType === id}
                        >
                          {label}
                        </button>
                      ))}
                    </fieldset>
                  </div>
                  {settings.windowFrameType === "browser" && (
                    <div className="control-group">
                      <label className="control-label" htmlFor="browser-url-input">
                        URL bar text
                      </label>
                      <input
                        id="browser-url-input"
                        type="text"
                        className="text-input"
                        value={settings.browserUrl}
                        onChange={(e) => setSettings({ browserUrl: e.target.value })}
                        placeholder="https://example.com"
                        spellCheck={false}
                        aria-label="URL shown in browser chrome"
                      />
                    </div>
                  )}
                  <div className="control-group">
                    <span className="mono-label">Export scale</span>
                    <fieldset
                      className="format-toggle"
                      aria-label="Export scale"
                      style={{ border: "none", padding: 0, margin: 0 }}
                    >
                      {([1, 2, 3] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`format-btn${settings.exportScale === s ? " format-btn--active" : ""}`}
                          onClick={() => setSettings({ exportScale: s })}
                          aria-pressed={settings.exportScale === s}
                        >
                          {s}x
                        </button>
                      ))}
                    </fieldset>
                  </div>
                  <div className="control-group">
                    <span className="mono-label">Format</span>
                    <fieldset
                      className="format-toggle"
                      aria-label="Export format"
                      style={{ border: "none", padding: 0, margin: 0 }}
                    >
                      {(["png", "jpg", "webp"] as ExportFormat[]).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          className={`format-btn${settings.exportFormat === fmt ? " format-btn--active" : ""}`}
                          onClick={() => setSettings({ exportFormat: fmt })}
                          aria-pressed={settings.exportFormat === fmt}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </fieldset>
                  </div>
                  <div className="control-group">
                    <span className="mono-label">Size preset</span>
                    <div className="preset-grid">
                      {SIZE_PRESETS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`format-btn format-btn-preset${settings.sizePresetId === p.id ? " format-btn--active" : ""}`}
                          onClick={() => setSettings({ sizePresetId: p.id })}
                          aria-pressed={settings.sizePresetId === p.id}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!sourceUrl && (
          <p className="empty-hint">
            Paste a screenshot from your clipboard, or drop a file. Nothing is uploaded.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no account." />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DropZone({
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
  onInputChange,
  inputRef,
  accepted,
}: {
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  accepted: string;
}) {
  return (
    <label
      className={`drop-zone${dragging ? " drop-zone--active" : ""}`}
      aria-label="Drop a screenshot here or click to select a file"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <FrameIcon />
      <span className="drop-zone-title">Drop a screenshot here or click to select</span>
      <span className="drop-zone-sub">
        PNG · JPG · WebP · paste from clipboard · runs in your browser
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={accepted}
        onChange={(e) => {
          onInputChange(e);
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />
    </label>
  );
}

function BgControls({
  bgKind,
  gradientId,
  solidColor,
  brandId,
  hasBgImage,
  onChange,
  onBgImageFile,
  onClearBgImage,
}: {
  bgKind: BgKind;
  gradientId: string;
  solidColor: string;
  brandId: string;
  hasBgImage: boolean;
  onChange: (patch: Partial<BeautifySettings>) => void;
  onBgImageFile: (file: File) => void;
  onClearBgImage: () => void;
}) {
  const bgImgInputRef = useRef<HTMLInputElement>(null);

  const handleBgImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.startsWith("image/")) {
      onBgImageFile(file);
    }
    e.target.value = "";
  };

  return (
    <div className="card">
      <div className="control-group" style={{ marginBottom: "1.25rem" }}>
        <span className="mono-label">Background</span>
        <fieldset
          className="format-toggle"
          aria-label="Background type"
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          {(["gradient", "solid", "brand", "image"] as BgKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`format-btn${bgKind === kind ? " format-btn--active" : ""}`}
              onClick={() => {
                if (kind === "image" && !hasBgImage) {
                  bgImgInputRef.current?.click();
                } else {
                  onChange({ bgKind: kind });
                }
              }}
              aria-pressed={bgKind === kind}
            >
              {kind === "gradient"
                ? "Gradient"
                : kind === "solid"
                  ? "Solid"
                  : kind === "brand"
                    ? "Brand"
                    : "Image"}
            </button>
          ))}
        </fieldset>
        {/* Hidden input for bg image upload */}
        <input
          ref={bgImgInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleBgImageChange}
          aria-label="Upload background image"
        />
      </div>

      {bgKind === "gradient" && (
        <div className="control-group">
          <span className="mono-label">Preset</span>
          <div className="gradient-grid">
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`gradient-swatch${gradientId === p.id ? " gradient-swatch--active" : ""}`}
                style={{
                  background: `linear-gradient(${p.angle}deg, ${p.stops[0]}, ${p.stops[1]})`,
                }}
                onClick={() => onChange({ gradientId: p.id })}
                aria-pressed={gradientId === p.id}
                title={p.label}
                aria-label={p.label}
              />
            ))}
          </div>
        </div>
      )}

      {bgKind === "solid" && (
        <div className="control-group">
          <label className="control-label" htmlFor="solid-color-picker">
            Colour
          </label>
          <div className="color-picker-row">
            <input
              id="solid-color-picker"
              type="color"
              value={solidColor}
              onChange={(e) => onChange({ solidColor: e.target.value })}
              className="color-picker-input"
              aria-label="Background colour"
            />
            <span className="mono-label" style={{ fontVariantNumeric: "tabular-nums" }}>
              {solidColor.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {bgKind === "brand" && (
        <div className="control-group">
          <span className="mono-label">Colour</span>
          <div className="brand-swatches">
            {BRAND_SOLIDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`brand-swatch${brandId === b.id ? " brand-swatch--active" : ""}`}
                style={{ background: b.color }}
                onClick={() => onChange({ brandId: b.id })}
                aria-pressed={brandId === b.id}
                title={b.label}
                aria-label={b.label}
              />
            ))}
          </div>
        </div>
      )}

      {bgKind === "image" && (
        <div className="control-group">
          <span className="mono-label">Background image</span>
          <div className="bg-image-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => bgImgInputRef.current?.click()}
            >
              {hasBgImage ? "Change image" : "Upload image"}
            </button>
            {hasBgImage && (
              <button
                type="button"
                className="btn-secondary btn-secondary--danger"
                onClick={onClearBgImage}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="control-group">
      <label className="control-label" htmlFor={id}>
        {label}
        <span className="control-value">
          {value}
          {unit}
        </span>
      </label>
      <div className="slider-wrap">
        <Slider
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          aria-label={label}
        />
      </div>
    </div>
  );
}

function FrameIcon() {
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
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <rect x="5" y="7" width="14" height="10" rx="1" />
      <path d="M9 3v2M15 3v2" />
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

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
