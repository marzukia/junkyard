import { BrandMark } from "@junkyardsh/ui";
import { Footer } from "@junkyardsh/ui";
import { Header } from "@junkyardsh/ui";
import { MobileWarning } from "@junkyardsh/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  assembleBlob,
  bestMimeType,
  isScreenCaptureSupported,
  startRecording,
} from "./lib/recorder";
import type { ActiveRecording } from "./lib/recorder";
import { useRecorderStore } from "./store";
import "@junkyardsh/ui/styles.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── BrandMark glyph for Screen Recorder ──────────────────────────────────────

function RecorderBrandGlyph() {
  return (
    <>
      {/* Monitor outline (teal) */}
      <rect x="2" y="4" width="24" height="17" rx="2.5" stroke="#2f9d8d" strokeWidth="2.2" />
      {/* Screen content area */}
      <rect x="6" y="8" width="16" height="9" rx="1.5" stroke="#2f9d8d" strokeWidth="1.5" />
      {/* REC dot (coral) */}
      <circle cx="24" cy="6" r="3" fill="#d9594c" />
      {/* Stand + base (amber) */}
      <line
        x1="14"
        y1="21"
        x2="14"
        y2="25"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="25"
        x2="18"
        y2="25"
        stroke="#e8b04b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export function App() {
  const {
    phase,
    resultUrl,
    elapsed,
    errorMsg,
    recordingIndex,
    setPhase,
    addChunk,
    setMimeType,
    setElapsed,
    setError,
    setResult,
    reset,
  } = useRecorderStore();

  const [systemAudio, setSystemAudio] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micTestActive, setMicTestActive] = useState(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAnimRef = useRef<number>(0);
  const [downloadFeedback, setDownloadFeedback] = useState(false);

  const activeRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const supported = isScreenCaptureSupported();

  // ── Timer management ────────────────────────────────────────────────────────
  // These are useCallback so they can be listed in dep arrays without
  // causing stale-closure issues (they only touch refs and setElapsed).

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
  }, [setElapsed]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      activeRef.current?.stop();
    };
  }, [stopTimer]);

  // ── Microphone level meter ─────────────────────────────────────────────────

  const startMicMonitor = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      micStreamRef.current = stream;
      micAnalyserRef.current = analyser;
      setMicTestActive(true);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] - 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setMicLevel(Math.min(1, rms / 128));
        micAnimRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMicLevel(0);
      setMicTestActive(false);
    }
  }, []);

  const stopMicMonitor = useCallback(() => {
    if (micAnimRef.current) cancelAnimationFrame(micAnimRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    micStreamRef.current = null;
    micAnalyserRef.current = null;
    setMicLevel(0);
    setMicTestActive(false);
  }, []);

  // Start/stop mic monitor when microphone toggle changes
  useEffect(() => {
    if (microphone && phase === "idle") {
      startMicMonitor();
    } else {
      stopMicMonitor();
    }
    return () => stopMicMonitor();
  }, [microphone, phase, startMicMonitor, stopMicMonitor]);

  // ── Finalize recording → build blob + object URL ─────────────────────────────

  const finalizeRecording = useCallback(
    (collectedChunks: Blob[], mime: string) => {
      stopTimer();
      const blob = assembleBlob(collectedChunks, mime);
      const url = URL.createObjectURL(blob);
      setResult(blob, url);
      setPhase("done");
    },
    [stopTimer, setResult, setPhase]
  );

  // ── Start ───────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (phase !== "idle" || !supported) return;

    // Determine MIME type upfront so we can pass it to finalizeRecording
    const mime = bestMimeType() || "video/webm";
    setMimeType(mime);

    // Collect chunks locally so the onstop handler has them synchronously
    // (store.chunks may lag behind due to async React batching).
    const localChunks: Blob[] = [];

    let active: ActiveRecording;
    try {
      active = await startRecording(
        { systemAudio, microphone },
        {
          onChunk: (chunk) => {
            localChunks.push(chunk);
            addChunk(chunk);
          },
          onTrackEnded: () => {
            // User clicked browser's native "Stop sharing" button.
            // The MediaRecorder may still be running; stop it cleanly.
            if (activeRef.current) {
              const mr = activeRef.current.mediaRecorder;
              // Attach onstop before calling stop so we capture remaining chunks.
              const prevOnStop = mr.onstop;
              mr.onstop = (e) => {
                if (prevOnStop) prevOnStop.call(mr, e);
                finalizeRecording(localChunks, mime);
              };
              activeRef.current.stop();
              activeRef.current = null;
            }
          },
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start recording.";
      setError(msg);
      return;
    }

    // Wire onstop for the normal Stop button path
    active.mediaRecorder.onstop = () => {
      finalizeRecording(localChunks, mime);
    };

    activeRef.current = active;
    setPhase("recording");
    startTimer();
  }, [
    phase,
    supported,
    systemAudio,
    microphone,
    setMimeType,
    setPhase,
    setError,
    addChunk,
    finalizeRecording,
    startTimer,
  ]);

  // ── Stop ────────────────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    if (phase !== "recording" || !activeRef.current) return;
    // onstop was already wired in handleStart
    activeRef.current.stop();
    activeRef.current = null;
  }, [phase]);

  // ── Download ────────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const filename = `recording-${recordingIndex + 1}.webm`;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadFeedback(true);
    setTimeout(() => setDownloadFeedback(false), 2000);
  }, [resultUrl, recordingIndex]);

  // ── Record again ─────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    stopTimer();
    activeRef.current?.stop();
    activeRef.current = null;
    reset();
  }, [stopTimer, reset]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-root">
      <Header
        title="Screen Recorder"
        subtitle="record your screen · mic + system audio · no upload, no account"
        brandMark={
          <BrandMark label="Screen Recorder">
            <RecorderBrandGlyph />
          </BrandMark>
        }
      />

      <main className="site-main">
        <MobileWarning />

        {/* Browser unsupported notice */}
        {!supported && (
          <div className="card rc-unsupported" role="alert">
            <UnsupportedIcon />
            <div>
              <p className="rc-unsupported-title">Screen capture not supported</p>
              <p className="rc-unsupported-body">
                Your browser does not support <code>getDisplayMedia</code>. Use Chrome, Edge, or
                Firefox on desktop to record your screen.
              </p>
            </div>
          </div>
        )}

        {/* Idle: controls + start */}
        {supported && phase === "idle" && (
          <div className="card rc-card">
            <p className="section-label">Audio options</p>
            <div className="rc-toggles">
              <label className="rc-toggle-row">
                <input
                  type="checkbox"
                  className="rc-checkbox"
                  checked={microphone}
                  onChange={(e) => setMicrophone(e.target.checked)}
                />
                <span className="rc-toggle-label">Record microphone</span>
              </label>
              {microphone && micTestActive && (
                <div className="rc-meter-wrap">
                  <div className="rc-meter-bar">
                    <div
                      className="rc-meter-fill"
                      style={{ width: `${micLevel * 100}%` }}
                    />
                  </div>
                  <span className="rc-meter-label">
                    {micLevel > 0.01 ? `${Math.round(micLevel * 100)}%` : "awaiting signal..."}
                  </span>
                </div>
              )}
              {microphone && !micTestActive && (
                <p className="rc-meter-label rc-meter-label--muted">
                  Mic access denied or unavailable
                </p>
              )}
              <label className="rc-toggle-row">
                <input
                  type="checkbox"
                  className="rc-checkbox"
                  checked={systemAudio}
                  onChange={(e) => setSystemAudio(e.target.checked)}
                />
                <span className="rc-toggle-label">
                  Record system audio
                  <span className="rc-toggle-hint"> (browser/tab audio, if supported)</span>
                </span>
              </label>
            </div>

            <div className="action-bar" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="btn-accent rc-start-btn" onClick={handleStart}>
                <RecIcon />
                Start Recording
              </button>
            </div>

            <p className="empty-hint" style={{ marginTop: "1rem" }}>
              You will be prompted to choose a screen, window, or tab to share. Nothing is uploaded
              — all recording happens in your browser.
            </p>
          </div>
        )}

        {/* Recording state */}
        {supported && phase === "recording" && (
          <div className="card rc-card">
            <output className="rc-recording-status" aria-live="polite">
              <span className="rc-rec-dot" aria-hidden="true" />
              <span className="rc-rec-label">REC</span>
              <span className="rc-elapsed">{formatElapsed(elapsed)}</span>
            </output>

            <p className="rc-recording-hint">
              Recording in progress. Click Stop or use the browser&rsquo;s Stop Sharing button.
            </p>

            <div className="action-bar" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="btn-accent rc-stop-btn" onClick={handleStop}>
                <StopIcon />
                Stop Recording
              </button>
            </div>
          </div>
        )}

        {/* Done: preview + download */}
        {supported && phase === "done" && resultUrl && (
          <div className="card rc-card">
            <p className="section-label">Preview</p>
            {/* biome-ignore lint/a11y/useMediaCaption: user-generated screen recording, captions not available */}
            <video
              src={resultUrl}
              controls
              className="rc-preview"
              aria-label="Recorded screen capture preview"
            />

            <div className="rc-result-row">
              <CheckIcon />
              <span className="rc-result-label">
                recording-{recordingIndex + 1}.webm &mdash; {formatElapsed(elapsed)} captured
              </span>
            </div>

            <div className="action-bar" style={{ marginTop: "1.25rem" }}>
              <button
                type="button"
                className={`btn-accent${downloadFeedback ? " btn-accent--success" : ""}`}
                onClick={handleDownload}
              >
                <DownloadIcon />
                {downloadFeedback ? "Downloaded!" : "Download WebM"}
              </button>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Record again
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {supported && phase === "error" && (
          <div className="card rc-card">
            <div className="error-banner" role="alert" aria-live="assertive">
              <ErrorIcon />
              <span>{errorMsg ?? "An unexpected error occurred."}</span>
            </div>
            <div className="action-bar" style={{ marginTop: "1.25rem" }}>
              <button type="button" className="btn-secondary" onClick={handleReset}>
                Try again
              </button>
            </div>
          </div>
        )}
      </main>

      <Footer blurb="No upload, no account. Recording stays in your browser." />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function RecIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
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

function UnsupportedIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "var(--ink-faint)", flexShrink: 0 }}
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <line x1="2" y1="3" x2="22" y2="17" />
    </svg>
  );
}
