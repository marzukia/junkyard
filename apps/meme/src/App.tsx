import { BrandMark } from "@junkyardsh/ui";
import { Footer } from "@junkyardsh/ui";
import { Header } from "@junkyardsh/ui";
import { Slider } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FONT_LABELS,
  type FontKey,
  type MemeTemplate,
  TEMPLATES,
  type TextLayer,
  clamp01,
  copyImageToClipboard,
  drawBlankTemplate,
  exportPng,
  hitTestLayers,
  renderMemeWithLayers,
  templateDefaultLayers,
} from "./meme";
import { useMemeStore } from "./store";

const CANVAS_MAX = 800;

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`copy-toast${visible ? " copy-toast--visible" : ""}`} aria-live="polite">
      <CheckIcon />
      {message}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const { imageDataUrl, layers, setImage, setLayers, updateLayer, addLayer, removeLayer, reset } =
    useMemeStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  const pendingSourceRef = useRef<HTMLCanvasElement | HTMLImageElement | null>(null);
  // Keep a stable ref to layers so the imageDataUrl effect can read without deps
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const [dragging, setDragging] = useState(false);
  const [dragTargetId, setDragTargetId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Copy-to-clipboard toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("Copied!");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2000);
  }, []);

  // When imageDataUrl changes, apply the pending source to the canvas
  useEffect(() => {
    if (!imageDataUrl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pending = pendingSourceRef.current;
    if (pending) {
      const naturalW =
        pending instanceof HTMLCanvasElement
          ? pending.width
          : (pending as HTMLImageElement).naturalWidth;
      const naturalH =
        pending instanceof HTMLCanvasElement
          ? pending.height
          : (pending as HTMLImageElement).naturalHeight;
      const ratio = naturalW / naturalH;
      canvas.width = Math.max(1, Math.min(naturalW, CANVAS_MAX));
      canvas.height = Math.max(1, Math.round(canvas.width / ratio));
      sourceRef.current = pending;
      pendingSourceRef.current = null;
    }
    const src = sourceRef.current;
    if (!src) return;
    renderMemeWithLayers(canvas, src, layersRef.current);
  }, [imageDataUrl]);

  // Re-render canvas whenever layers change
  useEffect(() => {
    const canvas = canvasRef.current;
    const src = sourceRef.current;
    if (!canvas || !src) return;
    renderMemeWithLayers(canvas, src, layers);
  }, [layers]);

  const loadImageFromDataUrl = useCallback(
    (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        pendingSourceRef.current = img;
        setImage(dataUrl);
      };
      img.onerror = () => showToast("Couldn't load that image");
      img.src = dataUrl;
    },
    [setImage, showToast]
  );

  const handleFileInput = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showToast("Image files only");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") {
          setActiveTemplate(null);
          loadImageFromDataUrl(result);
        }
      };
      reader.readAsDataURL(file);
    },
    [loadImageFromDataUrl]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileInput(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileInput(file);
  };

  const loadTemplate = useCallback(
    (template: MemeTemplate) => {
      setActiveTemplate(template.id);
      const tCanvas = drawBlankTemplate(template, CANVAS_MAX);
      const dataUrl = tCanvas.toDataURL("image/png");
      pendingSourceRef.current = tCanvas;
      setImage(dataUrl);
      setLayers(templateDefaultLayers(template));
    },
    [setImage, setLayers]
  );

  // ─── Mouse drag ─────────────────────────────────────────────────────────────

  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const hit = hitTestLayers(canvas, e.clientX, e.clientY, layers);
    if (hit) {
      setDragTargetId(hit);
      setDragging(true);
    }
  };

  const onCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging || !dragTargetId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = clamp01((e.clientX - rect.left) / rect.width);
      const y = clamp01((e.clientY - rect.top) / rect.height);
      updateLayer(dragTargetId, { x, y });
    },
    [dragging, dragTargetId, updateLayer]
  );

  const onCanvasMouseUp = () => {
    setDragging(false);
    setDragTargetId(null);
  };

  // ─── Touch drag ─────────────────────────────────────────────────────────────

  const onCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || e.touches.length === 0) return;
    const touch = e.touches[0];
    const hit = hitTestLayers(canvas, touch.clientX, touch.clientY, layers);
    if (hit) {
      e.preventDefault();
      setDragTargetId(hit);
      setDragging(true);
    }
  };

  const onCanvasTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (!dragging || !dragTargetId || e.touches.length === 0) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = clamp01((touch.clientX - rect.left) / rect.width);
      const y = clamp01((touch.clientY - rect.top) / rect.height);
      updateLayer(dragTargetId, { x, y });
    },
    [dragging, dragTargetId, updateLayer]
  );

  const onCanvasTouchEnd = () => {
    setDragging(false);
    setDragTargetId(null);
  };

  // ─── Export / Copy ──────────────────────────────────────────────────────────

  const [copying, setCopying] = useState(false);

  const handleCopyImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || copying) return;
    setCopying(true);
    try {
      await copyImageToClipboard(canvas);
      showToast("Copied!");
    } catch {
      showToast("Copy failed - try Export PNG");
    } finally {
      setCopying(false);
    }
  }, [copying, showToast]);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await exportPng(canvas);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meme.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      showToast("Saved!");
    } catch {
      showToast("Export failed");
    }
  };

  const handleReset = () => {
    sourceRef.current = null;
    setActiveTemplate(null);
    reset();
  };

  // ─── Keyboard shortcut ───────────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        // Primary action: copy image if there's a meme, else trigger upload
        if (imageDataUrl) {
          handleCopyImage();
        } else {
          inputRef.current?.click();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [imageDataUrl, handleCopyImage]);

  const hasImage = !!imageDataUrl;
  const canvasCursor = dragging ? "grabbing" : "crosshair";

  return (
    <div className="app-root">
      <Header
        title="Meme Generator"
        subtitle="impact text. multiple layers. drag. copy. no watermark."
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        {/* Upload or template picker if no image */}
        {!hasImage && (
          <>
            <label
              className={`drop-zone${isDragOver ? " drop-zone--active" : ""}`}
              aria-label="Drop an image here or click to upload"
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
            >
              <UploadIcon />
              <span className="drop-zone-title">Drop an image or click to upload</span>
              <span className="drop-zone-sub">JPG, PNG, WebP, GIF - runs in your browser</span>
              <span className="drop-zone-sub" style={{ marginTop: "0.2rem", opacity: 0.7 }}>
                or Cmd+Enter to open file picker
              </span>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onInputChange}
                style={{ display: "none" }}
              />
            </label>

            <div className="card">
              <p className="mono-label" style={{ marginBottom: "0.75rem" }}>
                Or start with a blank template
              </p>
              <div className="template-grid">
                {TEMPLATES.map((t) => (
                  <TemplateButton
                    key={t.id}
                    template={t}
                    active={activeTemplate === t.id}
                    onSelect={loadTemplate}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Editor workspace */}
        {hasImage && (
          <div className="meme-workspace">
            {/* Canvas */}
            <div className="canvas-container">
              <canvas
                ref={canvasRef}
                aria-label="Meme preview canvas"
                style={{ cursor: canvasCursor }}
                onMouseDown={onCanvasMouseDown}
                onMouseMove={onCanvasMouseMove}
                onMouseUp={onCanvasMouseUp}
                onMouseLeave={onCanvasMouseUp}
                onTouchStart={onCanvasTouchStart}
                onTouchMove={onCanvasTouchMove}
                onTouchEnd={onCanvasTouchEnd}
                onTouchCancel={onCanvasTouchEnd}
              />
              <Toast message={toastMessage} visible={toastVisible} />
            </div>

            {/* Sidebar controls */}
            <div className="sidebar-panel">
              {/* Text layers */}
              <div className="sidebar-section">
                <div className="sidebar-section-header">
                  <p className="sidebar-section-title">Text layers</p>
                  <button
                    type="button"
                    className="btn-add-layer"
                    onClick={addLayer}
                    aria-label="Add text layer"
                    title="Add text layer"
                  >
                    <PlusIcon /> Add
                  </button>
                </div>
                <p
                  className="mono-label"
                  style={{ fontSize: "0.55rem", opacity: 0.7, marginBottom: "0.25rem" }}
                >
                  Tap text on canvas to drag and reposition
                </p>
                {layers.map((layer, idx) => (
                  <LayerControl
                    key={layer.id}
                    layer={layer}
                    index={idx}
                    canRemove={layers.length > 1}
                    onChange={(patch) => updateLayer(layer.id, patch)}
                    onRemove={() => removeLayer(layer.id)}
                  />
                ))}
              </div>

              {/* Primary action: Copy */}
              <div
                className="action-bar"
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <button
                  type="button"
                  className="btn-accent"
                  onClick={handleCopyImage}
                  disabled={copying}
                  style={{ textAlign: "center" }}
                  title="Cmd+Enter"
                >
                  {copying ? "Copying..." : "Copy image"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleExport}
                  style={{ textAlign: "center" }}
                >
                  Export PNG
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReset}
                  style={{ textAlign: "center" }}
                >
                  New meme
                </button>
              </div>

              <p
                className="mono-label"
                style={{ textAlign: "center", fontSize: "0.55rem", opacity: 0.6 }}
              >
                Cmd+Enter to copy
              </p>
            </div>
          </div>
        )}

        {!hasImage && (
          <p className="empty-hint">
            Your image never leaves your browser. No upload, no account, no watermark.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no account." />
    </div>
  );
}

// ─── Layer control panel ──────────────────────────────────────────────────────

const FONT_KEYS: FontKey[] = ["impact", "arial", "comic", "mono"];
const PRESET_COLORS = ["#ffffff", "#000000", "#ffff00", "#ff0000", "#00ff88", "#00aaff"];

function LayerControl({
  layer,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  layer: TextLayer;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<TextLayer>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="layer-control">
      <div className="layer-control-header">
        <span className="layer-control-label">Layer {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            className="btn-remove-layer"
            onClick={onRemove}
            aria-label={`Remove layer ${index + 1}`}
            title="Remove layer"
          >
            <TrashIcon />
          </button>
        )}
      </div>
      <div className="text-input-group">
        <input
          className="text-input"
          type="text"
          placeholder={index === 0 ? "TOP TEXT" : index === 1 ? "BOTTOM TEXT" : "TEXT"}
          value={layer.text}
          onChange={(e) => onChange({ text: e.target.value })}
          autoComplete="off"
          aria-label={`Layer ${index + 1} text`}
        />
      </div>
      <div className="layer-row">
        <div className="control-group" style={{ flex: 1 }}>
          <label className="control-label" htmlFor={`layer-size-${layer.id}`}>
            Size
            <span className="control-value">{layer.sizePx}px</span>
          </label>
          <div className="slider-wrap">
            <Slider
              id={`layer-size-${layer.id}`}
              min={16}
              max={120}
              step={2}
              value={layer.sizePx}
              onChange={(v) => onChange({ sizePx: v })}
              aria-label={`Layer ${index + 1} font size`}
            />
          </div>
        </div>
      </div>
      <div className="layer-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <span className="control-label" style={{ whiteSpace: "nowrap" }}>
          Color
        </span>
        <div className="color-swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch${layer.color === c ? " color-swatch--active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
              aria-label={`Set text color to ${c}`}
              title={c}
            />
          ))}
          <input
            type="color"
            className="color-custom"
            value={layer.color}
            onChange={(e) => onChange({ color: e.target.value })}
            aria-label="Custom text color"
            title="Custom color"
          />
        </div>
      </div>
      <div className="layer-row" style={{ alignItems: "center", gap: "0.5rem" }}>
        <span className="control-label" style={{ whiteSpace: "nowrap" }}>
          Font
        </span>
        <div className="font-toggle">
          {FONT_KEYS.map((fk) => (
            <button
              key={fk}
              type="button"
              className={`font-btn${layer.font === fk ? " font-btn--active" : ""}`}
              onClick={() => onChange({ font: fk })}
              aria-pressed={layer.font === fk}
            >
              {FONT_LABELS[fk]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Template button sub-component ───────────────────────────────────────────

function TemplateButton({
  template,
  active,
  onSelect,
}: {
  template: MemeTemplate;
  active: boolean;
  onSelect: (t: MemeTemplate) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const tCanvas = drawBlankTemplate(template, 120);
    c.width = tCanvas.width;
    c.height = tCanvas.height;
    const ctx = c.getContext("2d");
    if (ctx) ctx.drawImage(tCanvas, 0, 0);
  }, [template]);

  return (
    <button
      type="button"
      className={`template-thumb${active ? " template-thumb--active" : ""}`}
      onClick={() => onSelect(template)}
      aria-label={`Use ${template.label} template`}
      aria-pressed={active}
      style={{ padding: 0, background: "none", border: "none", cursor: "pointer" }}
    >
      <div
        style={{
          borderRadius: "8px",
          overflow: "hidden",
          border: `2px solid ${active ? "var(--accent)" : "var(--rule)"}`,
          transition: "border-color 0.14s",
        }}
      >
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "auto" }} />
      </div>
      <div className="template-thumb-label">{template.label}</div>
    </button>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
      <polyline points="12 8 12 3 17 3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function PlusIcon() {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}
