/**
 * QrTab — QR code generator panel.
 *
 * Handles rendering via the `qrcode` library (browser-side canvas/dataURL),
 * QR content presets (text / URL / WiFi / vCard), and PNG/SVG download.
 *
 * Kept separate from App.tsx so the barcode and QR rendering paths don't
 * tangle. If the QR feature grows further (batch, custom colours, logo
 * overlay), this is the right file to extend.
 */

import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QrPreset } from "../lib/qr";
import { qrPresetLabel } from "../lib/qr";
import { useQrStore } from "../store/qrStore";

const PRESETS: QrPreset[] = ["text", "url", "wifi", "vcard"];

// ── Preset form ───────────────────────────────────────────────────────────

function TextUrlForm({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      className="bc-input qr-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
      aria-label="QR content"
    />
  );
}

function WifiForm() {
  const { wifi, setWifi } = useQrStore();
  return (
    <div className="qr-form-grid">
      <label className="qr-field">
        <span className="mono-label">Network name (SSID)</span>
        <input
          type="text"
          className="bc-input"
          value={wifi.ssid}
          onChange={(e) => setWifi({ ssid: e.target.value })}
          placeholder="My WiFi"
          autoComplete="off"
        />
      </label>
      <label className="qr-field">
        <span className="mono-label">Password</span>
        <input
          type="text"
          className="bc-input"
          value={wifi.password}
          onChange={(e) => setWifi({ password: e.target.value })}
          placeholder="(leave blank for open network)"
          autoComplete="off"
        />
      </label>
      <div className="qr-field qr-field--row">
        <span className="mono-label">Security</span>
        <div className="space-toggle" role="group" aria-label="WiFi security">
          {(["WPA", "WEP", "nopass"] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={`space-btn${wifi.security === s ? " space-btn--active" : ""}`}
              onClick={() => setWifi({ security: s })}
              aria-pressed={wifi.security === s}
            >
              {s === "nopass" ? "None" : s}
            </button>
          ))}
        </div>
      </div>
      <div className="qr-field qr-field--row">
        <span className="mono-label">Hidden network</span>
        <button
          type="button"
          className={`bc-toggle${wifi.hidden ? " bc-toggle--on" : ""}`}
          onClick={() => setWifi({ hidden: !wifi.hidden })}
          aria-pressed={wifi.hidden}
          aria-label="Toggle hidden network"
        >
          <span className="bc-toggle-knob" />
        </button>
      </div>
    </div>
  );
}

function VCardForm() {
  const { vcard, setVCard } = useQrStore();
  const fields: Array<{ key: keyof typeof vcard; label: string; placeholder: string }> = [
    { key: "name", label: "Full name", placeholder: "Jane Smith" },
    { key: "phone", label: "Phone", placeholder: "+1 555 000 0000" },
    { key: "email", label: "Email", placeholder: "jane@example.com" },
    { key: "org", label: "Organisation", placeholder: "Acme Corp" },
    { key: "url", label: "Website", placeholder: "https://example.com" },
  ];
  return (
    <div className="qr-form-grid">
      {fields.map(({ key, label, placeholder }) => (
        <label key={key} className="qr-field">
          <span className="mono-label">{label}</span>
          <input
            type="text"
            className="bc-input"
            value={vcard[key]}
            onChange={(e) => setVCard({ [key]: e.target.value })}
            placeholder={placeholder}
            autoComplete="off"
          />
        </label>
      ))}
    </div>
  );
}

// ── QR canvas renderer ────────────────────────────────────────────────────

async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  content: string,
  errorLevel: "L" | "M" | "Q" | "H"
): Promise<void> {
  await QRCode.toCanvas(canvas, content, {
    errorCorrectionLevel: errorLevel,
    margin: 2,
    width: 320,
    color: { dark: "#1a2530", light: "#ffffff" },
  });
}

async function qrToSvgString(content: string, errorLevel: "L" | "M" | "Q" | "H"): Promise<string> {
  return QRCode.toString(content, {
    type: "svg",
    errorCorrectionLevel: errorLevel,
    margin: 2,
    color: { dark: "#1a2530", light: "#ffffff" },
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ── Main QrTab ────────────────────────────────────────────────────────────

export function QrTab() {
  const { preset, rawInput, qrContent, errorLevel, setPreset, setRawInput, setErrorLevel } =
    useQrStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [hasQr, setHasQr] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const content = qrContent.trim();

  useEffect(() => {
    if (!canvasRef.current || !content) {
      setHasQr(false);
      setRenderError(null);
      return;
    }
    renderQrToCanvas(canvasRef.current, content, errorLevel).then(
      () => {
        setHasQr(true);
        setRenderError(null);
      },
      (err: unknown) => {
        setHasQr(false);
        setRenderError(err instanceof Error ? err.message : "Could not generate QR code.");
      }
    );
  }, [content, errorLevel]);

  const handleDownloadPng = useCallback(() => {
    if (!canvasRef.current || !hasQr) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) downloadBlob(blob, "qrcode.png");
    }, "image/png");
  }, [hasQr]);

  const handleDownloadSvg = useCallback(async () => {
    if (!hasQr || !content) return;
    const svg = await qrToSvgString(content, errorLevel);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, "qrcode.svg");
  }, [hasQr, content, errorLevel]);

  const handleCopyPng = useCallback(() => {
    if (!canvasRef.current || !hasQr) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2500);
        return;
      }
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(() => {
          setCopyState("copied");
          setTimeout(() => setCopyState("idle"), 2000);
        })
        .catch(() => {
          setCopyState("error");
          setTimeout(() => setCopyState("idle"), 2500);
        });
    }, "image/png");
  }, [hasQr]);

  return (
    <div className="bc-layout">
      {/* ── Controls ── */}
      <div className="card bc-controls-card">
        {/* Preset picker */}
        <div className="bc-section">
          <div className="space-toggle-wrapper">
            <span className="space-toggle-label">Type</span>
            <div className="space-toggle" role="group" aria-label="QR content type">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`space-btn${preset === p ? " space-btn--active" : ""}`}
                  onClick={() => setPreset(p)}
                  aria-pressed={preset === p}
                >
                  {qrPresetLabel(p)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content form */}
        <div className="bc-section">
          {preset === "text" && (
            <>
              <label className="mono-label" htmlFor="qr-text-input">
                Content
              </label>
              <TextUrlForm
                value={rawInput}
                onChange={setRawInput}
                placeholder="Any text to encode..."
              />
            </>
          )}
          {preset === "url" && (
            <>
              <label className="mono-label" htmlFor="qr-url-input">
                URL
              </label>
              <TextUrlForm
                value={rawInput}
                onChange={setRawInput}
                placeholder="example.com or https://..."
              />
            </>
          )}
          {preset === "wifi" && <WifiForm />}
          {preset === "vcard" && <VCardForm />}
        </div>

        {/* Error correction */}
        <div className="bc-section">
          <div className="space-toggle-wrapper">
            <span className="space-toggle-label">Error correction</span>
            <div className="space-toggle" role="group" aria-label="Error correction level">
              {(["L", "M", "Q", "H"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`space-btn${errorLevel === l ? " space-btn--active" : ""}`}
                  onClick={() => setErrorLevel(l)}
                  aria-pressed={errorLevel === l}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <p className="bc-format-hint">
            L=7% / M=15% / Q=25% / H=30% data recovery. Higher = larger QR.
          </p>
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="card bc-preview-card">
        <div className="bc-preview-header">
          <span className="mono-label">Preview</span>
          {hasQr && (
            <div className="copy-actions">
              <button
                type="button"
                className={`btn-secondary${copyState === "copied" ? " bc-copy--done" : copyState === "error" ? " bc-copy--err" : ""}`}
                onClick={handleCopyPng}
                aria-label="Copy QR code as PNG to clipboard"
              >
                {copyState === "copied"
                  ? "Copied!"
                  : copyState === "error"
                    ? "Copy failed"
                    : "Copy PNG"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadPng}
                aria-label="Download QR code as PNG"
              >
                Download PNG
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleDownloadSvg}
                aria-label="Download QR code as SVG"
              >
                Download SVG
              </button>
            </div>
          )}
        </div>

        <div className="bc-preview-canvas qr-preview-canvas" aria-label="QR code preview">
          {!content && !renderError && (
            <div className="bc-empty">
              <span className="bc-empty-glyph">
                <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" width="48" height="48">
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    stroke="var(--rule)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <rect
                    x="28"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    stroke="var(--rule)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <rect
                    x="4"
                    y="28"
                    width="16"
                    height="16"
                    rx="2"
                    stroke="var(--rule)"
                    strokeWidth="2.5"
                    fill="none"
                  />
                  <rect x="8" y="8" width="8" height="8" rx="1" fill="var(--rule)" />
                  <rect x="32" y="8" width="8" height="8" rx="1" fill="var(--rule)" />
                  <rect x="8" y="32" width="8" height="8" rx="1" fill="var(--rule)" />
                  <rect x="30" y="30" width="4" height="4" fill="var(--rule)" />
                  <rect x="36" y="30" width="4" height="4" fill="var(--rule)" />
                  <rect x="30" y="36" width="4" height="4" fill="var(--rule)" />
                  <rect x="36" y="36" width="4" height="4" fill="var(--rule)" />
                </svg>
              </span>
              <p className="bc-empty-text">Fill in the fields above to generate a QR code.</p>
            </div>
          )}
          {renderError && (
            <p className="bc-error bc-render-error" role="alert">
              <span className="bc-error-icon">!</span>
              {renderError}
            </p>
          )}
          <canvas
            ref={canvasRef}
            className={`qr-canvas${hasQr ? " qr-canvas--visible" : ""}`}
            aria-label="Generated QR code"
          />
        </div>
      </div>
    </div>
  );
}
