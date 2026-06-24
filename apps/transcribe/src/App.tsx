import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  ACCEPT_ATTR,
  downloadTextFile,
  formatBytes,
  formatElapsed,
  formatJSON,
  formatProgress,
  formatSRT,
  formatTimestamp,
  formatVTT,
  isSupportedAudio,
} from "./lib/audioHelpers";
import { MODEL_SIZE_MB } from "./lib/transcription";
import type { TranscriptionResult } from "./lib/transcription";
import { useWorkerTask } from "./lib/workerTask";

/** Track whether the model has been loaded at least once (persists across re-renders). */
const modelEverLoaded = { current: false };
import { LANGUAGE_OPTIONS, useTranscribeStore } from "./store/transcribeStore";
import "./styles/transcribe.css";
import { MobileWarning } from "./components/MobileWarning";

// ── Brand mark glyph, waveform for audio transcription ──────────────────────
// Clean line-art: teal waveform bars + amber speech-to-text arrow + coral mic dot

function TranscribeBrandGlyph() {
  return (
    <>
      {/* Waveform bars (teal, varying heights) */}
      <line
        x1="4"
        y1="20"
        x2="4"
        y2="12"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line x1="8" y1="22" x2="8" y2="8" stroke="#2f9d8d" strokeWidth="2.2" strokeLinecap="round" />
      <line
        x1="12"
        y1="24"
        x2="12"
        y2="6"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="21"
        x2="16"
        y2="10"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <line
        x1="20"
        y1="19"
        x2="20"
        y2="13"
        stroke="#2f9d8d"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Text lines suggesting transcript output (amber) */}
      <line
        x1="24"
        y1="10"
        x2="29"
        y2="10"
        stroke="#e8b04b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="14"
        x2="29"
        y2="14"
        stroke="#e8b04b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="18"
        x2="27"
        y2="18"
        stroke="#e8b04b"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Coral accent dot, the transcription cursor */}
      <circle cx="24" cy="24" r="2.2" fill="#d9594c" />
    </>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled: boolean;
  compact?: boolean;
}

function DropZone({ onFile, disabled, compact }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      onFile(file);
    },
    [onFile]
  );

  return (
    <button
      type="button"
      className={`tr-dropzone${dragging ? " tr-dropzone--drag" : ""}${disabled ? " tr-dropzone--disabled" : ""}${compact ? " tr-dropzone--compact" : ""}`}
      disabled={disabled}
      aria-label="Upload audio or video file, click or drag and drop"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--ink-faint)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      {!compact && (
        <>
          <span className="tr-dropzone-label">
            Drop an audio or video file here, or click to upload
          </span>
          <span className="tr-dropzone-hint">MP3, MP4, WAV, M4A, OGG, WebM, FLAC, MOV</span>
          <span className="tr-dropzone-microcopy">
            Outputs plain text, timestamped view, SRT, VTT, and JSON. Short clips (~1 min) finish in
            seconds; longer files may take a minute.
          </span>
        </>
      )}
      {compact && (
        <span className="tr-dropzone-label" style={{ fontSize: "0.78rem" }}>
          Upload another file
        </span>
      )}
    </button>
  );
}

// ── Microphone recorder ────────────────────────────────────────────────────────

interface MicRecorderProps {
  onFile: (file: File) => void;
  disabled: boolean;
}

type RecordState = "idle" | "recording" | "stopping";

function MicRecorder({ onFile, disabled }: MicRecorderProps) {
  const [recState, setRecState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        for (const t of stream.getTracks()) t.stop();
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "audio/webm").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording.${ext}`, { type: mr.mimeType || "audio/webm" });
        onFile(file);
        setRecState("idle");
        setElapsed(0);
      };
      mr.start(250);
      mediaRef.current = mr;
      setRecState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Microphone access denied.";
      setError(
        msg.includes("denied") || msg.includes("Permission")
          ? "Microphone access denied. Allow microphone in your browser settings."
          : `Could not start recording: ${msg}`
      );
    }
  }, [onFile]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecState("stopping");
    mediaRef.current?.stop();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRef.current?.stop();
    };
  }, []);

  const isRecording = recState === "recording";

  return (
    <div className="tr-mic-wrap">
      <button
        type="button"
        className={`tr-mic-btn${isRecording ? " tr-mic-btn--recording" : ""}`}
        disabled={disabled || recState === "stopping"}
        onClick={isRecording ? stopRecording : startRecording}
        aria-label={isRecording ? "Stop recording" : "Record from microphone"}
      >
        {isRecording ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span>{isRecording ? `Stop (${formatElapsed(elapsed)})` : "Record"}</span>
      </button>
      {error && <span className="tr-mic-error">{error}</span>}
    </div>
  );
}

// ── Model download gate dialog ──────────────────────────────────────────────────

interface ModelGateProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ModelGateDialog({ onConfirm, onCancel }: ModelGateProps) {
  return (
    <div className="tr-gate-overlay">
      <dialog className="tr-gate-card" open aria-label="Model download required">
        <p className="tr-gate-title">First-time download required</p>
        <p className="tr-gate-body">
          This tool uses Whisper, a speech recognition model that runs entirely in your browser. The
          first run downloads <strong>~{MODEL_SIZE_MB} MB</strong> of model weights from Hugging
          Face. On broadband this takes about 30 seconds. After that it is cached and works offline.
        </p>
        <div className="tr-gate-actions">
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Download and continue
          </button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

interface ProgressBarProps {
  loaded: number;
  total: number;
  label: string;
}

function ProgressBar({ loaded, total, label }: ProgressBarProps) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  return (
    <div
      className="tr-progress-wrap"
      role="progressbar"
      tabIndex={0}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="tr-progress-track">
        <div className="tr-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="tr-progress-label">
        {label}, {formatProgress(loaded, total)}
      </span>
    </div>
  );
}

// ── Transcript view tabs ──────────────────────────────────────────────────────

type TranscriptTab = "full" | "timestamps";

// ── Pre-baked sample transcript for "try a sample" ────────────────────────────
// This is a short fictional sample so users can see what the tool produces
// without needing to upload a file or trigger the 145 MB model download.

const SAMPLE_TEXT =
  "Welcome to Transcribe. This is an example of what your transcript will look like once you upload an audio or video file. The tool runs entirely in your browser, so your files never leave your device. On the first run it downloads the Whisper model once and caches it; every transcription after that is instant and works offline.";

const SAMPLE_CHUNKS = [
  { start: 0, end: 4.2, text: "Welcome to Transcribe." },
  {
    start: 4.2,
    end: 9.8,
    text: "This is an example of what your transcript will look like once you upload an audio or video file.",
  },
  {
    start: 9.8,
    end: 15.4,
    text: "The tool runs entirely in your browser, so your files never leave your device.",
  },
  {
    start: 15.4,
    end: 24.0,
    text: "On the first run it downloads the Whisper model once and caches it; every transcription after that is instant and works offline.",
  },
];

// ── Inline media player with VTT track ───────────────────────────────────────
// We build a blob VTT URL from chunks so the browser can show native captions.

interface MediaPlayerProps {
  mediaUrl: string;
  isVideo: boolean;
  label: string;
  chunks: Array<{ start: number; end: number | null; text: string }>;
  mediaRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
}

function MediaPlayer({ mediaUrl, isVideo, label, chunks, mediaRef }: MediaPlayerProps) {
  const [trackUrl, setTrackUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chunks.length) return;
    const vtt = formatVTT(chunks);
    const blob = new Blob([vtt], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    setTrackUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [chunks]);

  const track = trackUrl ? (
    <track kind="captions" src={trackUrl} srcLang="und" label="Transcript" default />
  ) : (
    <track kind="captions" />
  );

  if (isVideo) {
    return (
      <div className="tr-player-wrap">
        {/* biome-ignore lint/a11y/useMediaCaption: track element is present as a child */}
        <video
          ref={(el) => {
            mediaRef.current = el;
          }}
          src={mediaUrl}
          controls
          className="tr-media-player"
          aria-label={`Playback: ${label}`}
        >
          {track}
        </video>
      </div>
    );
  }
  return (
    <div className="tr-player-wrap">
      {/* biome-ignore lint/a11y/useMediaCaption: track element is present as a child */}
      <audio
        ref={(el) => {
          mediaRef.current = el;
        }}
        src={mediaUrl}
        controls
        className="tr-media-player tr-media-player--audio"
        aria-label={`Playback: ${label}`}
      >
        {track}
      </audio>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    inputFile,
    transcript,
    chunks,
    errorMsg,
    modelProgress,
    language,
    translateToEnglish,
    transcribeProgress,
    setInputFile,
    setPhase,
    setModelProgress,
    setResult,
    setError,
    setLanguage,
    setTranslateToEnglish,
    setTranscribeProgress,
    reset,
  } = useTranscribeStore();

  const [activeTab, setActiveTab] = useState<TranscriptTab>("full");
  const [copied, setCopied] = useState(false);
  const [isSample, setIsSample] = useState(false);
  // Gate: file waiting for user to confirm model download
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  // Elapsed timer for transcription phase
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Ref for the media element (inline audio/video player)
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  // Seek state for highlighted chunk
  const [seekingTo, setSeekingTo] = useState<number | null>(null);

  const busy = phase === "model-loading" || phase === "decoding" || phase === "transcribing";

  // Clean up object URL on new file or reset
  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  }, [mediaUrl]);

  const startElapsedTimer = useCallback(
    (getChunks: () => number) => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      const startTime = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTranscribeProgress({ elapsedSec: elapsed, chunksProcessed: getChunks() });
      }, 500);
    },
    [setTranscribeProgress]
  );

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopElapsedTimer();
  }, [stopElapsedTimer]);

  const { run: runWorker, cancel: cancelWorker } = useWorkerTask<
    { file: File; language?: string; translateToEnglish: boolean },
    TranscriptionResult
  >();

  const handleCancel = useCallback(() => {
    cancelWorker();
    stopElapsedTimer();
    setPhase("idle");
  }, [cancelWorker, stopElapsedTimer, setPhase]);

  const runTranscription = useCallback(
    async (file: File) => {
      setInputFile(file);
      // Create object URL for inline player
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      setMediaUrl(URL.createObjectURL(file));
      setSeekingTo(null);

      setPhase("model-loading");
      startElapsedTimer(() => 0);
      await runWorker(
        new URL("./infer.worker.ts", import.meta.url),
        { file, language: language !== "auto" ? language : undefined, translateToEnglish },
        {
          onProgress: (loaded, total, status) => {
            if (status === "decoding") {
              setPhase("decoding");
            } else {
              setModelProgress(loaded, total, status);
              setPhase("model-loading");
            }
          },
          onChunkProgress: (done) => {
            setPhase("transcribing");
            setTranscribeProgress({ elapsedSec: 0, chunksProcessed: done });
          },
          onResult: (result) => {
            stopElapsedTimer();
            modelEverLoaded.current = true;
            setResult(result.text, result.chunks);
            setActiveTab(result.chunks.length > 0 ? "timestamps" : "full");
          },
          onError: (message) => {
            stopElapsedTimer();
            setError(message);
          },
        }
      );
    },
    [
      setInputFile,
      setPhase,
      setModelProgress,
      setTranscribeProgress,
      setResult,
      setError,
      language,
      translateToEnglish,
      startElapsedTimer,
      stopElapsedTimer,
      mediaUrl,
      runWorker,
    ]
  );

  const handleFile = useCallback(
    (file: File) => {
      if (!isSupportedAudio(file)) {
        setError(
          `Unsupported file type "${file.type || "unknown"}". Please upload an audio or video file (MP3, MP4, WAV, M4A, OGG, WebM, FLAC, MOV).`
        );
        return;
      }
      setIsSample(false);
      if (!modelEverLoaded.current) {
        // Show the gate dialog before triggering the ~145 MB download
        setPendingFile(file);
        return;
      }
      void runTranscription(file);
    },
    [setError, runTranscription]
  );

  const handleGateConfirm = useCallback(() => {
    const file = pendingFile;
    setPendingFile(null);
    if (file) void runTranscription(file);
  }, [pendingFile, runTranscription]);

  const handleGateCancel = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleSample = useCallback(() => {
    setIsSample(true);
    setResult(SAMPLE_TEXT, SAMPLE_CHUNKS);
    setActiveTab("timestamps");
  }, [setResult]);

  const flashCopied = useCallback(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      flashCopied();
    } catch {
      // Clipboard API unavailable
    }
  }, [transcript, flashCopied]);

  const handleCopyTimestamps = useCallback(async () => {
    if (!chunks.length) return;
    const text = chunks.map((c) => `[${formatTimestamp(c.start)}] ${c.text}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      flashCopied();
    } catch {
      // Clipboard API unavailable
    }
  }, [chunks, flashCopied]);

  const baseName = inputFile ? inputFile.name.replace(/\.[^.]+$/, "") : "transcript";

  const handleDownloadTxt = useCallback(() => {
    downloadTextFile(`${baseName}.txt`, transcript);
  }, [transcript, baseName]);

  const handleDownloadSRT = useCallback(() => {
    if (!chunks.length) return;
    downloadTextFile(`${baseName}.srt`, formatSRT(chunks));
  }, [chunks, baseName]);

  const handleDownloadVTT = useCallback(() => {
    if (!chunks.length) return;
    downloadTextFile(`${baseName}.vtt`, formatVTT(chunks));
  }, [chunks, baseName]);

  const handleDownloadJSON = useCallback(() => {
    downloadTextFile(`${baseName}.json`, formatJSON(transcript, chunks));
  }, [transcript, chunks, baseName]);

  const handleReset = useCallback(() => {
    setIsSample(false);
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
      setMediaUrl(null);
    }
    setSeekingTo(null);
    reset();
  }, [reset, mediaUrl]);

  // Seek the inline player when a timestamp chunk is clicked
  const handleSeek = useCallback((startSec: number) => {
    setSeekingTo(startSec);
    const el = mediaRef.current;
    if (el) {
      el.currentTime = startSec;
      el.play().catch(() => {
        // Autoplay may be blocked; the user can press play manually
      });
    }
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+Enter triggers file upload (opens picker)
  const dropzoneInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && phase === "idle") {
        e.preventDefault();
        dropzoneInputRef.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase]);

  const isVideo = inputFile ? inputFile.type.startsWith("video/") : false;

  return (
    <div className="app-root">
      {pendingFile && <ModelGateDialog onConfirm={handleGateConfirm} onCancel={handleGateCancel} />}

      <Header
        title="Transcribe"
        subtitle="audio and video to text, free, private, runs in your browser"
        brandMark={
          <BrandMark label="Transcribe">
            <TranscribeBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />
        <p className="tr-beta-note">
          {modelEverLoaded.current ? (
            <>
              <strong className="tr-model-ready">Model ready</strong> &mdash; offline, instant. Your
              files never leave your device.
            </>
          ) : (
            <>
              <strong>Beta</strong>, first run downloads Whisper (~{MODEL_SIZE_MB} MB), then it is
              instant &amp; offline. Your files never leave your device.
            </>
          )}
        </p>

        <div className="card">
          {/* Upload zone */}
          {phase === "idle" && (
            <>
              <DropZone onFile={handleFile} disabled={false} />
              <div className="tr-idle-footer">
                <div className="tr-idle-controls">
                  <div className="tr-language-row">
                    <label htmlFor="tr-lang-select" className="tr-language-label">
                      Language
                    </label>
                    <select
                      id="tr-lang-select"
                      className="tr-language-select"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as typeof language)}
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="tr-translate-row">
                    <input
                      type="checkbox"
                      className="tr-translate-check"
                      checked={translateToEnglish}
                      onChange={(e) => setTranslateToEnglish(e.target.checked)}
                    />
                    <span className="tr-translate-label">Translate to English</span>
                  </label>
                </div>
                <div className="tr-idle-right">
                  <MicRecorder onFile={handleFile} disabled={false} />
                  <button
                    type="button"
                    className="btn-secondary tr-sample-btn"
                    onClick={handleSample}
                  >
                    Preview output
                  </button>
                </div>
              </div>
              <p className="tr-shortcut-hint">
                Tip: <kbd>Cmd</kbd>+<kbd>Enter</kbd> opens the file picker
              </p>
            </>
          )}

          {/* Model loading */}
          {phase === "model-loading" && (
            <div className="tr-status-wrap" role="status" aria-live="polite">
              <ProgressBar
                loaded={modelProgress.loaded}
                total={modelProgress.total}
                label="Downloading Whisper model"
              />
              <p className="tr-status-sub">
                One-time download (~{MODEL_SIZE_MB} MB). Saved in your browser cache.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Decoding */}
          {phase === "decoding" && (
            <div className="tr-status-wrap" role="status" aria-live="polite">
              <div className="tr-spinner" aria-label="Decoding audio" />
              <p className="tr-status-label">Decoding audio...</p>
              {inputFile && (
                <p className="tr-status-sub">
                  {inputFile.name} &middot; {formatBytes(inputFile.size)}
                </p>
              )}
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Transcribing with elapsed time */}
          {phase === "transcribing" && (
            <div className="tr-status-wrap" role="status" aria-live="polite">
              <div className="tr-spinner" aria-label="Transcribing" />
              <p className="tr-status-label">
                Transcribing
                {transcribeProgress.elapsedSec > 0
                  ? ` (${formatElapsed(transcribeProgress.elapsedSec)})`
                  : "..."}
              </p>
              {inputFile && (
                <p className="tr-status-sub">
                  {inputFile.name} &middot; {formatBytes(inputFile.size)}
                  {transcribeProgress.chunksProcessed > 0 && (
                    <> &middot; {transcribeProgress.chunksProcessed} segments done</>
                  )}
                </p>
              )}
              <p className="tr-status-hint">
                Long files can take a few minutes. The tab will stay active.
              </p>
              <button type="button" className="btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          )}

          {/* Result */}
          {phase === "done" && (
            <div className="tr-result-wrap">
              {isSample && (
                <p className="tr-sample-notice">
                  Sample output. Upload an audio file to transcribe your own content.
                </p>
              )}

              {/* Inline player for uploaded file */}
              {!isSample && mediaUrl && (
                <MediaPlayer
                  mediaUrl={mediaUrl}
                  isVideo={isVideo}
                  label={inputFile?.name ?? "uploaded file"}
                  chunks={chunks}
                  mediaRef={mediaRef}
                />
              )}

              <div className="tr-result-header">
                <div className="tr-tabs" role="tablist" aria-label="Transcript view">
                  <button
                    type="button"
                    role="tab"
                    className={`tr-tab${activeTab === "full" ? " tr-tab--active" : ""}`}
                    aria-selected={activeTab === "full"}
                    onClick={() => setActiveTab("full")}
                  >
                    Full text
                  </button>
                  {chunks.length > 0 && (
                    <button
                      type="button"
                      role="tab"
                      className={`tr-tab${activeTab === "timestamps" ? " tr-tab--active" : ""}`}
                      aria-selected={activeTab === "timestamps"}
                      onClick={() => setActiveTab("timestamps")}
                    >
                      Timestamps
                      {!isSample && mediaUrl && (
                        <span className="tr-tab-hint"> (click to seek)</span>
                      )}
                    </button>
                  )}
                </div>

                <div className="tr-result-actions">
                  {copied && <span className="tr-copy-feedback">Copied!</span>}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={activeTab === "timestamps" ? handleCopyTimestamps : handleCopy}
                    aria-label="Copy transcript to clipboard"
                  >
                    Copy
                  </button>
                  {!isSample && (
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleDownloadTxt}
                        aria-label="Download as plain text file"
                      >
                        TXT
                      </button>
                      {chunks.length > 0 && (
                        <>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleDownloadSRT}
                            aria-label="Download as SRT subtitle file"
                          >
                            SRT
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleDownloadVTT}
                            aria-label="Download as WebVTT subtitle file"
                          >
                            VTT
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleDownloadJSON}
                        aria-label="Download as JSON"
                      >
                        JSON
                      </button>
                    </>
                  )}
                  <button type="button" className="btn-secondary" onClick={handleReset}>
                    {isSample ? "Upload a file" : "Transcribe another"}
                  </button>
                </div>
              </div>

              {activeTab === "full" && (
                <section className="tr-fulltext" aria-label="Full transcript">
                  {transcript || (
                    <span className="tr-no-speech">
                      No speech detected. If you expected text, try:
                      <ul className="tr-no-speech-hints">
                        <li>Setting the language explicitly instead of Auto-detect</li>
                        <li>Checking that the audio is not too quiet or heavily compressed</li>
                        <li>Ensuring the file is not silent or corrupted</li>
                      </ul>
                    </span>
                  )}
                </section>
              )}

              {activeTab === "timestamps" && chunks.length > 0 && (
                <section className="tr-chunks" aria-label="Timestamped transcript">
                  {chunks.map((chunk) => (
                    <div
                      key={`${chunk.start}-${chunk.end ?? "end"}`}
                      className={`tr-chunk${seekingTo === chunk.start ? " tr-chunk--active" : ""}${!isSample && mediaUrl ? " tr-chunk--seekable" : ""}`}
                      onClick={!isSample && mediaUrl ? () => handleSeek(chunk.start) : undefined}
                      role={!isSample && mediaUrl ? "button" : undefined}
                      tabIndex={!isSample && mediaUrl ? 0 : undefined}
                      onKeyDown={
                        !isSample && mediaUrl
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSeek(chunk.start);
                              }
                            }
                          : undefined
                      }
                      aria-label={
                        !isSample && mediaUrl
                          ? `Seek to ${formatTimestamp(chunk.start)}: ${chunk.text}`
                          : undefined
                      }
                    >
                      <span
                        className="tr-chunk-time"
                        aria-label={`Timestamp ${formatTimestamp(chunk.start)}`}
                      >
                        {formatTimestamp(chunk.start)}
                      </span>
                      <span className="tr-chunk-text">{chunk.text}</span>
                    </div>
                  ))}
                </section>
              )}

              {inputFile && !isSample && (
                <p className="tr-file-meta mono-label">
                  {inputFile.name} &middot; {formatBytes(inputFile.size)}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="tr-error-wrap" role="alert" aria-live="assertive">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d9594c"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="tr-error-msg">{errorMsg}</p>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Upload another file when done or errored */}
        {(phase === "done" || phase === "error") && (
          <div className="card">
            <DropZone onFile={handleFile} disabled={busy} compact />
          </div>
        )}
      </main>

      <Footer blurb="Runs entirely in your browser. Your files never leave your device." />
    </div>
  );
}
