import { BrandMark } from "@junkyardsh/ui";
import { Footer } from "@junkyardsh/ui";
import { Header } from "@junkyardsh/ui";
import { MobileWarning } from "@junkyardsh/ui";
import { Slider } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isVideoFile } from "./lib/dropGuard";
import { formatBytes, formatTime, getFFmpeg, parseTime, runFFmpeg } from "./lib/ffmpeg";

// Warn when file exceeds this size
const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500 MB

type Mode = "trim" | "convert" | "compress" | "gif";
type ConvertFormat = "mp4" | "mov" | "gif";
type ScalePreset = "original" | "1080p" | "720p" | "480p" | "360p";

interface Result {
  blob: Blob;
  name: string;
  url: string;
  size: number;
}

const SCALE_PRESETS: ScalePreset[] = ["original", "1080p", "720p", "480p", "360p"];

function scaleFilter(preset: ScalePreset): string | null {
  const map: Record<ScalePreset, string | null> = {
    original: null,
    "1080p": "scale=-2:1080",
    "720p": "scale=-2:720",
    "480p": "scale=-2:480",
    "360p": "scale=-2:360",
  };
  return map[preset];
}

export function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [mode, setMode] = useState<Mode>("trim");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [coreLoading, setCoreLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trim state
  const [trimStart, setTrimStart] = useState("0:00");
  const [trimEnd, setTrimEnd] = useState("0:00");

  // Convert state
  const [convertFormat, setConvertFormat] = useState<ConvertFormat>("mp4");

  // Compress state
  const [scalePreset, setScalePreset] = useState<ScalePreset>("720p");
  const [crf, setCrf] = useState(28);

  // GIF state
  const [gifFps, setGifFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pre-warm the ffmpeg instance in the background once a file is chosen
  useEffect(() => {
    if (!file) return;
    setCoreLoading(true);
    getFFmpeg(() => {})
      .catch(() => setError("Couldn't load the video engine - check your connection and reload."))
      .finally(() => setCoreLoading(false));
  }, [file]);

  const handleFile = useCallback(
    (f: File) => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setFile(f);
      setResult(null);
      setError(null);
      setProgress(0);
      const url = URL.createObjectURL(f);
      setVideoUrl(url);
      setTrimStart("0:00");
    },
    [videoUrl]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    if (!isVideoFile(f)) {
      setError("Please drop a video file.");
      return;
    }
    handleFile(f);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const onVideoLoaded = () => {
    const dur = videoRef.current?.duration ?? 0;
    setDuration(dur);
    setTrimEnd(formatTime(dur));
  };

  const buildArgs = (): { args: string[]; outputName: string } | null => {
    if (!file) return null;

    const baseName = file.name.replace(/\.[^.]+$/, "");

    if (mode === "trim") {
      const start = parseTime(trimStart);
      const end = parseTime(trimEnd);
      const dur = end - start;
      if (dur <= 0) {
        setError("End time must be after start time.");
        return null;
      }
      return {
        args: ["-ss", String(start), "-t", String(dur), "-c", "copy"],
        outputName: `${baseName}_trimmed.mp4`,
      };
    }

    if (mode === "convert") {
      const ext = convertFormat;
      const args: string[] = [];
      if (ext === "gif") {
        args.push("-vf", "fps=10,scale=480:-1:flags=lanczos", "-loop", "0");
      } else if (ext === "mp4") {
        args.push("-c:v", "libx264", "-crf", "23", "-preset", "fast", "-c:a", "aac");
      } else if (ext === "mov") {
        args.push("-c:v", "libx264", "-crf", "23", "-preset", "fast", "-c:a", "aac");
      }
      return { args, outputName: `${baseName}.${ext}` };
    }

    if (mode === "compress") {
      const args: string[] = [
        "-c:v",
        "libx264",
        "-crf",
        String(crf),
        "-preset",
        "fast",
        "-c:a",
        "aac",
      ];
      const filter = scaleFilter(scalePreset);
      if (filter) args.splice(0, 0, "-vf", filter);
      return { args, outputName: `${baseName}_compressed.mp4` };
    }

    if (mode === "gif") {
      return {
        args: [
          "-vf",
          `fps=${gifFps},scale=${gifWidth}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          "-loop",
          "0",
        ],
        outputName: `${baseName}.gif`,
      };
    }

    return null;
  };

  // Revoke object URLs on unmount to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  const run = async () => {
    if (!file || processing) return;
    const built = buildArgs();
    if (!built) return;

    // Revoke any previous result URL before overwriting it (H1: blob URL leak).
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const blob = await runFFmpeg(file, built.args, built.outputName, setProgress);
      const url = URL.createObjectURL(blob);
      setResult({ blob, name: built.outputName, url, size: blob.size });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Processing failed";
      setError(msg);
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.name;
    // Some popup blockers prevent programmatic clicks. If the anchor is not
    // appended to the DOM the click may be silently swallowed -- fall back to
    // opening the URL in a new tab so the user can save manually (W1).
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const reset = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (result) URL.revokeObjectURL(result.url);
    setFile(null);
    setVideoUrl(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setDuration(0);
  };

  const MODES: { key: Mode; label: string }[] = [
    { key: "trim", label: "Trim" },
    { key: "convert", label: "Convert" },
    { key: "compress", label: "Compress" },
    { key: "gif", label: "To GIF" },
  ];

  return (
    <div className="app-root">
      <Header
        title="Video"
        subtitle="trim, convert, compress, gif - in your browser"
        brandMark={<BrandMark />}
      />

      <main className="site-main">
        <MobileWarning />
        {/* Drop zone */}
        {!file && (
          <label
            className={`drop-zone${dragging ? " drop-zone--active" : ""}`}
            aria-label="Drop a video file here or click to select"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={() => setDragging(false)}
          >
            <VideoUploadIcon />
            <span className="drop-zone-title">Drop a video here or click to select</span>
            <span className="drop-zone-sub">
              MP4, WebM, MOV, AVI, MKV - all processing runs in your browser
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              onChange={onInputChange}
              style={{ display: "none" }}
            />
          </label>
        )}

        {file && (
          <>
            {/* Large file warning */}
            {file.size > LARGE_FILE_THRESHOLD && (
              <div className="warn-banner" role="alert">
                <WarnIcon />
                <span>
                  This file is {formatBytes(file.size)} - processing may be slow in a browser
                  context. Consider splitting or compressing externally first.
                </span>
              </div>
            )}

            {/* Video preview */}
            <div className="card video-preview-card">
              {/* biome-ignore lint/a11y/useMediaCaption: user-supplied video, captions not available */}
              <video
                ref={videoRef}
                src={videoUrl ?? undefined}
                controls
                className="video-preview"
                onLoadedMetadata={onVideoLoaded}
                onError={() => setError("Couldn't read this video file.")}
              />
              <div className="video-meta">
                <span className="mono-label">{file.name}</span>
                <span className="video-meta-sep">·</span>
                <span className="mono-label">{formatBytes(file.size)}</span>
                {duration > 0 && (
                  <>
                    <span className="video-meta-sep">·</span>
                    <span className="mono-label">{formatTime(duration)}</span>
                  </>
                )}
                <button type="button" className="btn-ghost-sm" onClick={reset}>
                  Change file
                </button>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="mode-tabs" role="tablist" aria-label="Operation mode">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.key}
                  className={`mode-tab${mode === m.key ? " mode-tab--active" : ""}`}
                  onClick={() => {
                    setMode(m.key);
                    setResult(null);
                    setError(null);
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Mode panels */}
            <div className="card" role="tabpanel">
              {mode === "trim" && (
                <TrimPanel
                  duration={duration}
                  start={trimStart}
                  end={trimEnd}
                  onStart={setTrimStart}
                  onEnd={setTrimEnd}
                  videoRef={videoRef}
                />
              )}
              {mode === "convert" && (
                <ConvertPanel format={convertFormat} onFormat={setConvertFormat} />
              )}
              {mode === "compress" && (
                <CompressPanel
                  preset={scalePreset}
                  crf={crf}
                  onPreset={setScalePreset}
                  onCrf={setCrf}
                />
              )}
              {mode === "gif" && (
                <GifPanel fps={gifFps} width={gifWidth} onFps={setGifFps} onWidth={setGifWidth} />
              )}

              {/* Core loading indicator */}
              {coreLoading && (
                <div className="core-loading" aria-live="polite">
                  <SpinnerIcon />
                  <span>Loading ffmpeg core...</span>
                </div>
              )}

              {/* Progress */}
              {processing && (
                <div className="progress-section" aria-live="polite">
                  <div className="progress-bar-wrap">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <span className="progress-label">
                    {Math.round(progress * 100)}% - processing in browser...
                  </span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="error-banner" role="alert">
                  <ErrorIcon />
                  <span>{error}</span>
                </div>
              )}

              {/* Result */}
              {result && (
                <div className="result-banner" aria-live="polite">
                  <CheckIcon />
                  <div className="result-info">
                    <span className="result-filename">{result.name}</span>
                    <span className="result-size">
                      {formatBytes(result.size)}
                      {file && result.size < file.size && (
                        <span className="result-saving">
                          {" "}
                          -{Math.round((1 - result.size / file.size) * 100)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <button type="button" className="btn-accent" onClick={download}>
                    <DownloadIcon />
                    Download
                  </button>
                </div>
              )}

              {/* Run button */}
              <div className="action-bar" style={{ marginTop: "1.25rem" }}>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={run}
                  disabled={processing || coreLoading || !file}
                  aria-busy={processing}
                >
                  {processing
                    ? "Processing..."
                    : coreLoading
                      ? "Loading ffmpeg..."
                      : modeLabel(mode)}
                </button>
                {result && (
                  <span className="empty-hint" style={{ padding: 0 }}>
                    Done - ready to download above
                  </span>
                )}
              </div>
            </div>
          </>
        )}

        {!file && (
          <p className="empty-hint">
            All video processing runs in your browser. Nothing is uploaded.
          </p>
        )}
      </main>

      <Footer blurb="Powered by ffmpeg.wasm. No upload, no account." />
    </div>
  );
}

function modeLabel(mode: Mode): string {
  return { trim: "Trim clip", convert: "Convert", compress: "Compress", gif: "Export GIF" }[mode];
}

// Sub-panels

function TrimPanel({
  duration,
  start,
  end,
  onStart,
  onEnd,
  videoRef,
}: {
  duration: number;
  start: string;
  end: string;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}) {
  const startSec = parseTime(start);
  const endSec = parseTime(end);
  const [startSlider, setStartSlider] = useState(0);
  const [endSlider, setEndSlider] = useState(duration > 0 ? duration : 0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);

  // Sync sliders with text input values whenever they change
  useEffect(() => {
    if (duration > 0) {
      setStartSlider(startSec);
      setEndSlider(endSec);
    }
  }, [start, end, duration]);

  /** Returns true only when input matches a strictly valid time format (s, MM:SS, HH:MM:SS). */
  const isValidTimeFormat = (input: string): boolean => {
    const trimmed = input.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
    const parts = trimmed.split(":").map(Number);
    if (parts.some(Number.isNaN)) return false;
    if (parts.length === 2 && parts[0] >= 0 && parts[1] >= 0 && parts[1] < 60) return true;
    if (parts.length === 3 && parts[0] >= 0 && parts[1] >= 0 && parts[1] < 60 && parts[2] >= 0 && parts[2] < 60) return true;
    return false;
  };

  const seekVideo = useCallback(
    (sec: number) => {
      if (videoRef?.current) {
        videoRef.current.currentTime = Math.max(0, Math.min(sec, duration));
      }
    },
    [videoRef, duration]
  );

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const clickSec = pct * duration;

      // Determine which handle is closer
      const dStart = Math.abs(clickSec - startSec);
      const dEnd = Math.abs(clickSec - endSec);

      if (dStart <= dEnd) {
        // Move start handle
        const clamped = Math.max(0, Math.min(clickSec, endSec - 1));
        onStart(formatTime(clamped));
        seekVideo(clamped);
      } else {
        // Move end handle
        const clamped = Math.max(startSec + 1, Math.min(clickSec, duration));
        onEnd(formatTime(clamped));
        seekVideo(clamped);
      }
    },
    [duration, startSec, endSec, onStart, onEnd, seekVideo]
  );

  const handleDragStart = useCallback(
    (handle: "start" | "end") => (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = handle;
      e.currentTarget.setPointerCapture(e.pointerId);
      const onPointerMove = (ev: PointerEvent) => {
        if (duration <= 0) return;
        const rect = timelineRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const sec = pct * duration;

        if (handle === "start") {
          const clamped = Math.max(0, Math.min(sec, endSec - 1));
          onStart(formatTime(clamped));
          seekVideo(clamped);
        } else {
          const clamped = Math.max(startSec + 1, Math.min(sec, duration));
          onEnd(formatTime(clamped));
          seekVideo(clamped);
        }
      };

      const onPointerUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [duration, startSec, endSec, onStart, onEnd, seekVideo]
  );

  const handleSliderStart = useCallback(
    (v: number) => {
      const clamped = Math.max(0, Math.min(Math.round(v), endSec - 1));
      onStart(formatTime(clamped));
      seekVideo(clamped);
    },
    [endSec, onStart, seekVideo]
  );

  const handleSliderEnd = useCallback(
    (v: number) => {
      const clamped = Math.max(startSec + 1, Math.min(Math.round(v), duration));
      onEnd(formatTime(clamped));
      seekVideo(clamped);
    },
    [startSec, duration, onEnd, seekVideo]
  );

  if (duration <= 0) {
    return (
      <div className="panel-grid">
        <p className="panel-hint">Load a video to see trim controls.</p>
      </div>
    );
  }

  const startPct = (startSec / duration) * 100;
  const endPct = (endSec / duration) * 100;

  return (
    <div className="panel-grid">
      {/* Visual timeline scrubber */}
      <div className="trim-timeline-wrap">
        <div
          ref={timelineRef}
          className="trim-timeline"
          onClick={handleTimelineClick}
          role="slider"
          aria-label="Trim timeline"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={startSec}
        >
          <div className="trim-timeline-track" />
          <div
            className="trim-timeline-range"
            style={{ left: `${startPct}%`, width: `${Math.max(0, endPct - startPct)}%` }}
          />
          <div
            className="trim-handle trim-handle--start"
            style={{ left: `${startPct}%` }}
            onPointerDown={handleDragStart("start")}
            onClick={(e) => e.stopPropagation()}
            role="slider"
            aria-label="Trim start"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={startSec}
            tabIndex={0}
          />
          <div
            className="trim-handle trim-handle--end"
            style={{ left: `${endPct}%` }}
            onPointerDown={handleDragStart("end")}
            onClick={(e) => e.stopPropagation()}
            role="slider"
            aria-label="Trim end"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={endSec}
            tabIndex={0}
          />
          <span className="trim-timeline-time trim-timeline-time--start" style={{ left: `${startPct}%` }}>
            {formatTime(startSec)}
          </span>
          <span className="trim-timeline-time trim-timeline-time--end" style={{ left: `${endPct}%` }}>
            {formatTime(endSec)}
          </span>
        </div>
      </div>

      {/* Slider controls */}
      <div className="control-group">
        <label className="control-label" htmlFor="trim-start-slider">
          Start
          <span className="control-value">{formatTime(startSec)}</span>
        </label>
        <div className="trim-slider-row">
          <div className="slider-wrap">
            <Slider
              id="trim-start-slider"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={startSlider}
              onChange={handleSliderStart}
              aria-label="Trim start time slider"
            />
          </div>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="trim-end-slider">
          End
          <span className="control-value">{formatTime(endSec)}</span>
        </label>
        <div className="trim-slider-row">
          <div className="slider-wrap">
            <Slider
              id="trim-end-slider"
              min={0}
              max={Math.max(1, duration)}
              step={1}
              value={endSlider}
              onChange={handleSliderEnd}
              aria-label="Trim end time slider"
            />
          </div>
        </div>
      </div>

      {/* Exact text inputs */}
      <div className="control-group">
        <label className="control-label" htmlFor="trim-start">
          Start time (exact)
        </label>
        <input
          id="trim-start"
          className="time-input"
          type="text"
          value={start}
          onChange={(e) => {
            onStart(e.target.value);
            if (isValidTimeFormat(e.target.value)) {
              const parsed = parseTime(e.target.value);
              if (parsed >= 0 && parsed <= duration) {
                seekVideo(parsed);
              }
            }
          }}
          placeholder="0:00"
          aria-label="Trim start time (MM:SS)"
        />
      </div>
      <div className="control-group">
        <label className="control-label" htmlFor="trim-end">
          End time (exact)
        </label>
        <input
          id="trim-end"
          className="time-input"
          type="text"
          value={end}
          onChange={(e) => {
            onEnd(e.target.value);
            if (isValidTimeFormat(e.target.value)) {
              const parsed = parseTime(e.target.value);
              if (parsed >= 0 && parsed <= duration) {
                seekVideo(parsed);
              }
            }
          }}
          placeholder="0:00"
          aria-label="Trim end time (MM:SS)"
        />
      </div>

      {/* Clip length summary */}
      <div className="control-group">
        <p className="control-label">
          Clip length
          <span className="control-value">
            {formatTime(Math.max(0, endSec - startSec))} of {formatTime(duration)}
          </span>
        </p>
      </div>

      <p className="panel-hint">Output is exported as MP4 with stream copy (no re-encode).</p>
    </div>
  );
}

function ConvertPanel({
  format,
  onFormat,
}: {
  format: ConvertFormat;
  onFormat: (f: ConvertFormat) => void;
}) {
  const FORMATS: ConvertFormat[] = ["mp4", "mov", "gif"];
  return (
    <div className="panel-grid">
      <div className="control-group">
        <span className="mono-label">Output format</span>
        <fieldset
          className="format-toggle"
          aria-label="Output format"
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              className={`format-btn${format === f ? " format-btn--active" : ""}`}
              onClick={() => onFormat(f)}
              aria-pressed={format === f}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="panel-hint">
        {format === "mp4" && "H.264 + AAC. Widest compatibility across browsers and devices."}
        {format === "mov" && "H.264 + AAC in a QuickTime container. Apple-native."}
        {format === "gif" && "Animated GIF at 10 fps, 480px wide. Lossy palette reduction."}
      </p>
    </div>
  );
}

function CompressPanel({
  preset,
  crf,
  onPreset,
  onCrf,
}: {
  preset: ScalePreset;
  crf: number;
  onPreset: (p: ScalePreset) => void;
  onCrf: (v: number) => void;
}) {
  return (
    <div className="panel-grid">
      <div className="control-group">
        <span className="mono-label">Resolution</span>
        <fieldset
          className="format-toggle"
          aria-label="Resolution preset"
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          {SCALE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`format-btn${preset === p ? " format-btn--active" : ""}`}
              onClick={() => onPreset(p)}
              aria-pressed={preset === p}
            >
              {p}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="control-group">
        <label className="control-label" htmlFor="crf-slider">
          Quality (CRF)
          <span className="control-value">{crf}</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="crf-slider"
            min={18}
            max={40}
            step={1}
            value={crf}
            onChange={onCrf}
            aria-label="CRF quality (lower = better)"
          />
        </div>
        <span className="panel-hint">
          18 = near-lossless, 28 = good balance, 40 = smallest file
        </span>
      </div>
    </div>
  );
}

function GifPanel({
  fps,
  width,
  onFps,
  onWidth,
}: {
  fps: number;
  width: number;
  onFps: (v: number) => void;
  onWidth: (v: number) => void;
}) {
  return (
    <div className="panel-grid">
      <div className="control-group">
        <label className="control-label" htmlFor="gif-fps">
          Frame rate (fps)
          <span className="control-value">{fps}</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="gif-fps"
            min={5}
            max={30}
            step={1}
            value={fps}
            onChange={onFps}
            aria-label="GIF frame rate"
          />
        </div>
      </div>
      <div className="control-group">
        <label className="control-label" htmlFor="gif-width">
          Width (px)
          <span className="control-value">{width}</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="gif-width"
            min={120}
            max={960}
            step={40}
            value={width}
            onChange={onWidth}
            aria-label="GIF output width in pixels"
          />
        </div>
      </div>
      <p className="panel-hint">
        Uses palette optimization for best quality. Height scales proportionally.
      </p>
    </div>
  );
}

// Icons

function VideoUploadIcon() {
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
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M9 10l6 4-6 4V10z" />
      <path d="M6 2l2 4M18 2l-2 4" />
    </svg>
  );
}

function WarnIcon() {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ErrorIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
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

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      className="spinner-icon"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
