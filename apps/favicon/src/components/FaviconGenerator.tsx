import JSZip from "jszip";
import { useCallback, useEffect, useState } from "react";
import {
  FAVICON_SIZES,
  buildHtmlSnippet,
  buildIco,
  buildManifest,
  canvasToBlob,
  drawTextToCanvas,
  drawToCanvas,
  sanitiseAppName,
} from "../lib/faviconCore";
import { useFaviconStore } from "../lib/faviconStore";
import { CanvasControls } from "./CanvasControls";
import { ContextualPreview } from "./ContextualPreview";
import { PreviewGrid } from "./PreviewGrid";
import { TextEmojiInput } from "./TextEmojiInput";
import { UploadZone } from "./UploadZone";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export function FaviconGenerator() {
  const {
    sourceMode,
    sourceUrl,
    sourceText,
    appName,
    canvasOptions,
    status,
    errorMsg,
    progress,
    zipUrl,
    setSourceMode,
    setAppName,
    setStatus,
    setPreviews,
    setZipUrl,
    setProgress,
  } = useFaviconStore();

  const isReady =
    (sourceMode === "image" && !!sourceUrl) ||
    ((sourceMode === "text" || sourceMode === "emoji") && sourceText.trim().length > 0);

  const generate = useCallback(async () => {
    if (!isReady) return;

    // Snapshot the source at the moment generation starts.  If the user switches
    // mode mid-run, setSourceMode() revokes sourceUrl — loading it after that
    // throws "Failed to load image".  We bail quietly instead of showing an error.
    const snapMode = sourceMode;
    const snapUrl = sourceUrl;

    setStatus("generating");
    setProgress(0);

    try {
      const steps = FAVICON_SIZES.length + 3;
      let done = 0;
      const tick = () => {
        done++;
        setProgress(Math.round((done / steps) * 100));
      };

      const pngBlobs: { size: number; blob: Blob; filename: string }[] = [];
      const previews = [];

      for (const entry of FAVICON_SIZES) {
        // Bail if the source was changed/revoked since we started
        if (snapMode !== sourceMode || (snapMode === "image" && snapUrl !== sourceUrl)) {
          setStatus("idle");
          return;
        }
        let canvas: HTMLCanvasElement;

        if (snapMode === "image" && snapUrl) {
          const img = await loadImage(snapUrl);
          canvas = drawToCanvas(img, entry.size, canvasOptions);
        } else {
          canvas = drawTextToCanvas(sourceText.trim(), entry.size, canvasOptions);
        }

        const blob = await canvasToBlob(canvas);
        pngBlobs.push({ size: entry.size, blob, filename: entry.filename });
        previews.push({
          size: entry.size,
          label: entry.label,
          filename: entry.filename,
          dataUrl: canvas.toDataURL("image/png"),
        });
        tick();
      }

      setPreviews(previews);

      // Build favicon.ico from 16, 32, 48 frames
      const icoSizes = [16, 32, 48];
      const icoFrames = await Promise.all(
        icoSizes.map(async (sz) => {
          let canvas: HTMLCanvasElement;
          if (snapMode === "image" && snapUrl) {
            const img = await loadImage(snapUrl);
            canvas = drawToCanvas(img, sz, canvasOptions);
          } else {
            canvas = drawTextToCanvas(sourceText.trim(), sz, canvasOptions);
          }
          const blob = await canvasToBlob(canvas);
          const buf = await blob.arrayBuffer();
          return { size: sz, data: new Uint8Array(buf) };
        })
      );
      const icoBytes = buildIco(icoFrames);
      tick();

      const safeName = sanitiseAppName(appName);
      const manifestStr = buildManifest(safeName);
      tick();

      const htmlSnippet = buildHtmlSnippet(safeName);
      tick();

      const zip = new JSZip();
      for (const { blob, filename } of pngBlobs) {
        zip.file(filename, blob);
      }
      zip.file("favicon.ico", icoBytes);
      zip.file("site.webmanifest", manifestStr);
      zip.file("snippet.html", htmlSnippet);
      zip.file("README.txt", buildReadme(safeName));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      setZipUrl(url);
      setStatus("done");
      setProgress(100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setStatus("error", msg);
    }
  }, [
    isReady,
    sourceMode,
    sourceUrl,
    sourceText,
    appName,
    canvasOptions,
    setStatus,
    setProgress,
    setPreviews,
    setZipUrl,
  ]);

  // Cmd/Ctrl+Enter triggers generate
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (isReady && status !== "generating") {
          void generate();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [generate, isReady, status]);

  const safeName = sanitiseAppName(appName);
  const snippet = buildHtmlSnippet(safeName);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Source mode toggle */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <span className="section-label" style={{ marginBottom: 0, marginRight: "0.5rem" }}>
          Source
        </span>
        <div className="space-toggle">
          {(["image", "text", "emoji"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`space-btn${sourceMode === m ? " space-btn--active" : ""}`}
              onClick={() => setSourceMode(m)}
              aria-pressed={sourceMode === m}
            >
              {m === "image" ? "Image" : m === "text" ? "Text / initials" : "Emoji"}
            </button>
          ))}
        </div>
      </div>

      {/* Layout: source input left, settings right */}
      <div className="favicon-layout">
        <div className="card">
          {sourceMode === "image" && <UploadZone />}
          {sourceMode === "text" && <TextEmojiInput mode="text" />}
          {sourceMode === "emoji" && <TextEmojiInput mode="emoji" />}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Canvas options */}
          <CanvasControls />

          {/* App name */}
          <div>
            <span className="section-label">App name</span>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="My App"
              maxLength={45}
              aria-label="App name for manifest and snippet"
              style={{
                width: "100%",
                padding: "0.55rem 0.8rem",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          </div>

          {/* Generate / download */}
          <div>
            <div className="action-row" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void generate()}
                disabled={!isReady || status === "generating"}
                title={
                  !isReady
                    ? sourceMode === "image"
                      ? "Upload a PNG or SVG image first"
                      : "Enter text or pick an emoji first"
                    : "Generate favicon set (Cmd+Enter)"
                }
              >
                {status === "generating" ? "Generating..." : "Generate favicon set"}
              </button>

              {zipUrl && (
                <a href={zipUrl} download="favicon-set.zip" className="btn-secondary">
                  Download .zip
                </a>
              )}
            </div>

            {!isReady && (
              <p className="generate-hint">
                {sourceMode === "image"
                  ? "Upload a PNG or SVG to enable generation"
                  : sourceMode === "text"
                    ? "Enter initials or text to enable generation"
                    : "Enter an emoji to enable generation"}
              </p>
            )}

            {status === "generating" && (
              <div className="progress-bar-wrap" role="status" aria-live="polite">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            )}

            {status === "done" && (
              <div style={{ marginTop: "0.75rem" }} role="status" aria-live="polite">
                <span className="status-badge">
                  Ready. {FAVICON_SIZES.length} sizes + ico + manifest
                </span>
              </div>
            )}

            {status === "error" && (
              <div style={{ marginTop: "0.75rem" }} role="alert" aria-live="assertive">
                <span className="status-badge status-badge--error">{errorMsg}</span>
              </div>
            )}

            {isReady && status !== "generating" && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  color: "var(--ink-faint)",
                  marginTop: "0.5rem",
                }}
              >
                Tip: Cmd+Enter to generate
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Size preview grid */}
      <PreviewGrid />

      {/* Contextual preview (browser tab, bookmark, maskable) */}
      <ContextualPreview />

      {/* HTML snippet */}
      {status === "done" && (
        <div className="card">
          <span className="section-label">HTML snippet</span>
          <p style={{ fontSize: "0.8rem", color: "var(--ink-mid)", marginBottom: "0.25rem" }}>
            Paste into your{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>
              &lt;head&gt;
            </code>
          </p>
          <div className="snippet-box">{snippet}</div>
          <div className="action-row">
            <CopyButton text={snippet} label="Copy snippet" />
          </div>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available in some non-secure contexts
    }
  };

  return (
    <button
      type="button"
      className={`btn-secondary${copied ? " btn-secondary--copied" : ""}`}
      onClick={handleCopy}
      aria-live="polite"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function buildReadme(appName: string): string {
  return `Favicon set generated by junkyard.mrzk.io/favicon/
App: ${appName}

Files:
  favicon-16x16.png     - 16x16 browser tab
  favicon-32x32.png     - 32x32 browser tab (retina)
  favicon-48x48.png     - 48x48 Windows shortcut
  apple-touch-icon.png  - 180x180 iOS home screen
  icon-192.png          - 192x192 Android PWA
  icon-512.png          - 512x512 Android PWA splash
  favicon.ico           - Multi-size ICO (16/32/48) for legacy browsers
  site.webmanifest      - Web app manifest
  snippet.html          - HTML <head> snippet

Place all .png and .ico files in your site root.
Paste the contents of snippet.html into your <head>.
`;
}
