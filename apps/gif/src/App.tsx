import { BrandMark, Footer, Header, formatBytes } from "@junkyardsh/kit";
import { Slider } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { encodeGif, estimateGifBytes, formatDuration, msToFpsLabel } from "./gif";
import type { GifFrame } from "./gif";
import { useGifStore } from "./store";

const ACCEPTED_IMAGE = ".jpg,.jpeg,.png,.webp,.gif";
const ACCEPTED_VIDEO = ".mp4,.webm,.mov";
const ACCEPTED = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO},image/*,video/*`;

/** Slider tick marks for delay, 20ms to 2000ms. */
const DELAY_MARKS = [
  { value: 20, label: "" },
  { value: 100, label: "" },
  { value: 500, label: "" },
  { value: 2000, label: "" },
];

export function App() {
  const {
    frames,
    globalDelayMs,
    loops,
    maxDim,
    caption,
    videoFrameCount,
    addFrames,
    removeFrame,
    moveFrame,
    setFrameDelay,
    setGlobalDelay,
    setLoops,
    setMaxDim,
    setCaption,
    setVideoFrameCount,
    clearAll,
  } = useGifStore();

  const [dragging, setDragging] = useState(false);
  const [encoding, setEncoding] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [encodeError, setEncodeError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importingVideo, setImportingVideo] = useState(false);
  const [singleFrameWarning, setSingleFrameWarning] = useState(false);

  // Drag-to-reorder state
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragSourceIdx = useRef<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track the current output blob so we can copy it
  const outputBlobRef = useRef<Blob | null>(null);

  // Revoke previous output URL when a new one is generated or component unmounts
  const prevOutputUrl = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (prevOutputUrl.current) URL.revokeObjectURL(prevOutputUrl.current);
    };
  }, []);

  // Clear output when frames change so stale preview doesn't linger
  const framesKey = frames.map((f) => f.id).join(",");
  const prevFramesKey = useRef(framesKey);
  useEffect(() => {
    if (prevFramesKey.current !== framesKey) {
      prevFramesKey.current = framesKey;
      setOutputUrl(null);
      setOutputSize(null);
      setEncodeError(null);
      setSingleFrameWarning(false);
      outputBlobRef.current = null;
    }
  }, [framesKey]);

  // Cmd/Ctrl+Enter triggers Build GIF
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (frames.length > 0 && !encoding) {
          void onEncode();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) return;
      const all = Array.from(incoming);
      const images = all.filter((f) => f.type.startsWith("image/"));
      const videos = all.filter((f) => f.type.startsWith("video/"));
      if (images.length === 0 && videos.length === 0) return;

      setImportError(null);
      if (videos.length > 0) setImportingVideo(true);
      try {
        await addFrames([...images, ...videos]);
      } catch (err) {
        setImportError(
          `Import failed: ${err instanceof Error ? err.message : "Could not load file"}`
        );
      } finally {
        setImportingVideo(false);
      }
    },
    [addFrames]
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      await handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFiles(e.target.files);
    e.target.value = "";
  };

  const onEncode = async () => {
    if (frames.length === 0 || encoding) return;
    if (frames.length < 2) {
      setSingleFrameWarning(true);
      return;
    }
    setSingleFrameWarning(false);
    setEncoding(true);
    setEncodeError(null);
    setOutputUrl(null);
    setOutputSize(null);
    outputBlobRef.current = null;
    try {
      const blob = await encodeGif(frames, globalDelayMs, loops, maxDim, caption || undefined);
      if (prevOutputUrl.current) URL.revokeObjectURL(prevOutputUrl.current);
      const url = URL.createObjectURL(blob);
      prevOutputUrl.current = url;
      outputBlobRef.current = blob;
      setOutputUrl(url);
      setOutputSize(blob.size);
    } catch (err) {
      setEncodeError(err instanceof Error ? err.message : "Encoding failed");
    } finally {
      setEncoding(false);
    }
  };

  const onDownload = () => {
    if (!outputUrl) return;
    const a = document.createElement("a");
    a.href = outputUrl;
    a.download = "animation.gif";
    a.click();
  };

  const onCopyImage = async () => {
    if (!outputBlobRef.current) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/gif": outputBlobRef.current })]);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy the object URL as text if ClipboardItem isn't supported
      try {
        if (outputUrl) await navigator.clipboard.writeText(outputUrl);
        setCopied(true);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // Silent fail -- browser doesn't allow clipboard access
      }
    }
  };

  const onClearAll = () => {
    clearAll();
    setOutputUrl(null);
    setOutputSize(null);
    setEncodeError(null);
    setSingleFrameWarning(false);
    outputBlobRef.current = null;
  };

  // Drag-to-reorder handlers for frame rows
  const onFrameDragStart = (idx: number) => {
    dragSourceIdx.current = idx;
  };
  const onFrameDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const onFrameDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragSourceIdx.current !== null && dragSourceIdx.current !== idx) {
      moveFrame(dragSourceIdx.current, idx);
    }
    dragSourceIdx.current = null;
    setDragOverIdx(null);
  };
  const onFrameDragEnd = () => {
    dragSourceIdx.current = null;
    setDragOverIdx(null);
  };

  // Live stats: total duration and estimated output size
  const totalDurationMs = frames.reduce(
    (sum, f) => sum + (f.delayMs !== null ? f.delayMs : globalDelayMs),
    0
  );
  const firstFrame = frames[0];
  const estimatedBytes =
    firstFrame &&
    estimateGifBytes(
      Math.min(firstFrame.width, maxDim),
      Math.min(firstFrame.height, maxDim),
      frames.length
    );

  return (
    <div className="app-root">
      <Header
        title="GIF Maker"
        subtitle="images + video to animated gif - reorder frames - set delay - no upload"
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        {/* Drop zone: label wraps the hidden input so mouse/drag clicks work;
            keyboard users can also Tab to the label (tabIndex=0 + role=button) or
            use the "Add files" button rendered below when frames exist. */}
        <label
          className={`drop-zone${dragging ? " drop-zone--active" : ""}${importingVideo ? " drop-zone--importing" : ""}`}
          aria-label="Drop images or videos here or press Enter to select files"
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {importingVideo ? (
            <>
              <SpinnerIcon size={32} />
              <span className="drop-zone-title">Extracting video frames...</span>
            </>
          ) : (
            <>
              <FilmIcon />
              <span className="drop-zone-title">Drop images or video here, or click to select</span>
              <span className="drop-zone-sub">
                JPG, PNG, WebP, GIF frames, MP4, WebM. Add more to append.
              </span>
            </>
          )}
          {/* Visually hidden: aria-hidden so SR reads the label text, not "Choose File" */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={onInputChange}
            aria-hidden="true"
            tabIndex={-1}
            style={{ position: "absolute", opacity: 0, width: 0, height: 0, overflow: "hidden" }}
          />
        </label>

        {/* Import error */}
        {importError && (
          <p className="encode-error" role="alert">
            {importError}
          </p>
        )}

        {/* Single-frame warning */}
        {singleFrameWarning && (
          <p className="frame-count-nudge" role="alert">
            Add at least 2 images to animate. A single frame makes a still GIF.
          </p>
        )}

        {/* Frame list */}
        {frames.length > 0 && (
          <div className="card">
            <div className="frames-header">
              <div className="frames-header-left">
                <span className="mono-label">
                  {frames.length} frame{frames.length !== 1 ? "s" : ""}
                </span>
                {frames.length < 2 && (
                  <span className="frames-nudge">Add at least 2 images to animate</span>
                )}
                {frames.length >= 2 && (
                  <span className="frames-stats">
                    {formatDuration(totalDurationMs)}
                    {estimatedBytes ? ` ~ ${formatBytes(estimatedBytes)}` : ""}
                  </span>
                )}
              </div>
              <div className="action-bar" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={onEncode}
                  disabled={encoding || frames.length === 0}
                  aria-busy={encoding}
                  title="Build GIF (Ctrl+Enter / Cmd+Enter)"
                >
                  {encoding ? (
                    <>
                      <SpinnerIcon size={13} /> Encoding...
                    </>
                  ) : (
                    <>
                      Build GIF
                      <span className="btn-meta">
                        {typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
                          ? "⌘↵"
                          : "Ctrl+↵"}
                      </span>
                    </>
                  )}
                </button>
                <button type="button" className="btn-secondary" onClick={onClearAll}>
                  Clear all
                </button>
              </div>
            </div>

            <div className="frame-list" aria-label="Frame list" aria-live="polite">
              {frames.map((frame, idx) => (
                <FrameRow
                  key={frame.id}
                  frame={frame}
                  index={idx}
                  total={frames.length}
                  globalDelayMs={globalDelayMs}
                  isDragOver={dragOverIdx === idx}
                  onRemove={() => removeFrame(frame.id)}
                  onMoveUp={() => moveFrame(idx, idx - 1)}
                  onMoveDown={() => moveFrame(idx, idx + 1)}
                  onSetDelay={(ms) => setFrameDelay(frame.id, ms)}
                  onDragStart={() => onFrameDragStart(idx)}
                  onDragOver={(e) => onFrameDragOver(e, idx)}
                  onDrop={(e) => onFrameDrop(e, idx)}
                  onDragEnd={onFrameDragEnd}
                />
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="card">
          <div className="controls-grid">
            <div className="control-group">
              <label className="control-label" htmlFor="delay-slider">
                Frame delay
                <span className="control-value">
                  {globalDelayMs}ms ({msToFpsLabel(globalDelayMs)})
                </span>
              </label>
              <div className="slider-wrap">
                <Slider
                  id="delay-slider"
                  min={20}
                  max={2000}
                  step={10}
                  value={globalDelayMs}
                  onChange={setGlobalDelay}
                  aria-label="Global frame delay in milliseconds"
                  marks={DELAY_MARKS}
                />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="loops-input">
                Loops
                <span className="control-value">{loops === 0 ? "infinite" : `${loops}x`}</span>
              </label>
              <div className="slider-wrap">
                <Slider
                  id="loops-input"
                  min={0}
                  max={20}
                  step={1}
                  value={loops}
                  onChange={setLoops}
                  aria-label="Loop count (0 = infinite)"
                  marks={[
                    { value: 0, label: "" },
                    { value: 10, label: "" },
                    { value: 20, label: "" },
                  ]}
                />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="maxdim-slider">
                Max dimension
                <span className="control-value">{maxDim}px</span>
              </label>
              <div className="slider-wrap">
                <Slider
                  id="maxdim-slider"
                  min={100}
                  max={1200}
                  step={50}
                  value={maxDim}
                  onChange={setMaxDim}
                  aria-label="Maximum output dimension in pixels"
                  marks={[
                    { value: 100, label: "" },
                    { value: 600, label: "" },
                    { value: 1200, label: "" },
                  ]}
                />
              </div>
              <div className="maxdim-input-row">
                <input
                  type="number"
                  min={100}
                  max={1200}
                  step={50}
                  value={maxDim}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    if (!Number.isNaN(v) && v >= 100 && v <= 1200) setMaxDim(v);
                  }}
                  className="delay-input"
                  aria-label="Maximum output dimension, pixels"
                />
                <span className="delay-unit">px</span>
              </div>
            </div>
          </div>

          {/* Caption overlay */}
          <div className="caption-row">
            <label className="control-label" htmlFor="caption-input">
              Caption overlay
              <span className="control-value" style={{ fontWeight: 400, opacity: 0.7 }}>
                burned into every frame
              </span>
            </label>
            <input
              id="caption-input"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Optional text shown at bottom of each frame"
              className="caption-input"
              maxLength={120}
            />
          </div>
        </div>

        {/* Video options - only shown when there are video-sourced frames */}
        {frames.some((f) => f.file.name.includes("_frame")) && (
          <div className="card">
            <div className="control-group">
              <label className="control-label" htmlFor="video-frames-slider">
                Frames per video
                <span className="control-value">{videoFrameCount}</span>
              </label>
              <div className="slider-wrap">
                <Slider
                  id="video-frames-slider"
                  min={2}
                  max={30}
                  step={1}
                  value={videoFrameCount}
                  onChange={setVideoFrameCount}
                  aria-label="Number of frames to extract from each video"
                  marks={[
                    { value: 2, label: "" },
                    { value: 10, label: "" },
                    { value: 30, label: "" },
                  ]}
                />
              </div>
              <p className="control-hint">
                Applied on next video import. Re-import the video to use the new count.
              </p>
            </div>
          </div>
        )}

        {/* Output */}
        {(outputUrl || encodeError) && (
          <div className="card output-card">
            {encodeError && (
              <p className="encode-error" role="alert">
                {encodeError}
              </p>
            )}
            {outputUrl && (
              <>
                <div className="output-preview-wrap">
                  <img
                    src={outputUrl}
                    alt="Generated animated GIF preview"
                    className="output-preview"
                    id="gif-output-preview"
                  />
                </div>
                <div className="output-meta">
                  {outputSize !== null && (
                    <span className="mono-label">{formatBytes(outputSize)}</span>
                  )}
                </div>
                <div className="action-bar" style={{ marginTop: "0.75rem" }}>
                  <button type="button" className="btn-accent" onClick={onDownload}>
                    <DownloadIcon /> Download animation.gif
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary${copied ? " btn-secondary--copied" : ""}`}
                    onClick={onCopyImage}
                    aria-label="Copy GIF to clipboard"
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                    {copied ? "Copied!" : "Copy image"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {frames.length === 0 && (
          <p className="empty-hint">
            Your images and videos are processed entirely in your browser. Nothing is uploaded.
          </p>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. No upload, no account." />
    </div>
  );
}

interface FrameRowProps {
  frame: GifFrame;
  index: number;
  total: number;
  globalDelayMs: number;
  isDragOver: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSetDelay: (ms: number | null) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function FrameRow({
  frame,
  index,
  total,
  globalDelayMs,
  isDragOver,
  onRemove,
  onMoveUp,
  onMoveDown,
  onSetDelay,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: FrameRowProps) {
  const effectiveDelay = frame.delayMs !== null ? frame.delayMs : globalDelayMs;
  const hasOverride = frame.delayMs !== null;

  return (
    <div
      className={`frame-row${isDragOver ? " frame-row--drag-over" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="frame-drag-handle" title="Drag to reorder" aria-hidden="true">
        <DragHandleIcon />
      </span>
      <span className="frame-index mono-label">{String(index + 1).padStart(2, "0")}</span>

      <img
        src={frame.previewUrl}
        alt={`Frame ${index + 1}: ${frame.file.name}`}
        className="frame-thumb"
      />

      <div className="frame-info">
        <span className="frame-name" title={frame.file.name}>
          {frame.file.name}
        </span>
        <span className="frame-dims">
          {frame.width}x{frame.height}
        </span>
      </div>

      <div className="frame-delay-wrap">
        <label htmlFor={`delay-${frame.id}`} className="mono-label">
          delay
        </label>
        <div className="frame-delay-row">
          <input
            id={`delay-${frame.id}`}
            type="number"
            min={20}
            max={60000}
            step={10}
            value={effectiveDelay}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(v)) onSetDelay(v);
            }}
            className="delay-input"
            aria-label={`Frame ${index + 1} delay in milliseconds`}
          />
          <span className="delay-unit">ms</span>
          {hasOverride && (
            <button
              type="button"
              className="btn-secondary delay-reset"
              onClick={() => onSetDelay(null)}
              title="Reset to global delay"
            >
              reset
            </button>
          )}
        </div>
      </div>

      <div className="frame-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label={`Move frame ${index + 1} earlier`}
          title="Move up"
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label={`Move frame ${index + 1} later`}
          title="Move down"
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          onClick={onRemove}
          aria-label={`Remove frame ${index + 1}`}
          title="Remove frame"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

function FilmIcon() {
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
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <rect x="5" y="3" width="2" height="3" rx="0.5" />
      <rect x="11" y="3" width="2" height="3" rx="0.5" />
      <rect x="17" y="3" width="2" height="3" rx="0.5" />
      <rect x="5" y="18" width="2" height="3" rx="0.5" />
      <rect x="11" y="18" width="2" height="3" rx="0.5" />
      <rect x="17" y="18" width="2" height="3" rx="0.5" />
      <path d="M10 9.5 L10 14.5 L15 12 Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
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
      width="13"
      height="13"
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
      width="13"
      height="13"
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

function ArrowUpIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 15 L12 9 L6 15" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  );
}

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="spinner-icon"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
