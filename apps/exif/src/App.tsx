import { useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "./components/BrandMark";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import {
  SENSITIVE_KEYS,
  buildMapUrl,
  canvasOutputType,
  cleanFilename,
  csvEscape,
  exifToJson,
  exportBasename,
  extractGps,
  formatExifValue,
  getPrivacyVerdict,
  sortExifKeys,
} from "./exif-utils";
import { useExifStore } from "./store";
import { stripExif } from "./strip";
import { useCmdEnter } from "./components/useCmdEnter";

/** Trigger a browser file download from a string payload. */
function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Copy text to clipboard, returning true on success. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Show a brief "Copied!" flash on a button. */
function useCopyFlash() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const flash = useCallback(async (key: string, text: string): Promise<void> => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    }
  }, []);
  return { copiedKey, flash };
}

// exifr is ESM; dynamic import avoids issues with test environments
async function parseExif(file: File): Promise<{
  exif: Record<string, unknown> | null;
  xmp: Record<string, unknown> | null;
  iptc: Record<string, unknown> | null;
}> {
  try {
    const exifr = await import("exifr");
    const [exif, xmp, iptc] = await Promise.all([
      exifr.parse(file, { gps: true, xmp: false, iptc: false }).catch(() => null),
      exifr.parse(file, { xmp: true, exif: false, gps: false, iptc: false }).catch(() => null),
      exifr.parse(file, { iptc: true, exif: false, gps: false, xmp: false }).catch(() => null),
    ]);
    return {
      exif: (exif as Record<string, unknown> | undefined) ?? null,
      xmp: (xmp as Record<string, unknown> | undefined) ?? null,
      iptc: (iptc as Record<string, unknown> | undefined) ?? null,
    };
  } catch {
    return { exif: null, xmp: null, iptc: null };
  }
}

function DropZone({
  onFiles,
  onUnsupported,
}: {
  onFiles: (files: File[]) => void;
  onUnsupported?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const all = Array.from(e.dataTransfer.files);
      const images = all.filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        onFiles(images);
      } else if (all.length > 0) {
        onUnsupported?.();
      }
    },
    [onFiles, onUnsupported]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const all = Array.from(e.target.files ?? []);
      const images = all.filter((f) => f.type.startsWith("image/"));
      if (images.length) {
        onFiles(images);
      } else if (all.length > 0) {
        onUnsupported?.();
      }
      // Reset so same file can be re-added
      if (inputRef.current) inputRef.current.value = "";
    },
    [onFiles, onUnsupported]
  );

  return (
    // Using <label> gives us native click/keyboard-activate to the hidden input
    // without needing role="button" on a div, and avoids aria-hidden on a focusable element.
    <label
      className="drop-zone"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      aria-label="Drop images here or click to browse"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="drop-zone-input"
      />
      <div className="drop-zone-icon">
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <title>Camera icon</title>
          <rect x="4" y="10" width="40" height="28" rx="4" fill="var(--accent)" opacity="0.15" />
          <rect x="4" y="10" width="40" height="28" rx="4" stroke="var(--accent)" strokeWidth="2" />
          <circle cx="24" cy="24" r="7" fill="var(--accent)" opacity="0.3" />
          <circle cx="24" cy="24" r="7" stroke="var(--accent)" strokeWidth="2" />
          <circle cx="24" cy="24" r="3" fill="var(--accent)" />
          <rect x="10" y="12" width="8" height="3" rx="1.5" fill="var(--accent)" opacity="0.5" />
        </svg>
      </div>
      <p className="drop-zone-label">Drop images here</p>
      <p className="drop-zone-hint">or click to browse · JPEG, PNG, TIFF, HEIC, WebP</p>
    </label>
  );
}

function ImageThumb({
  objectUrl,
  fileName,
  isSelected,
  hasGps,
  onSelect,
  onRemove,
}: {
  id: string;
  objectUrl: string;
  fileName: string;
  isSelected: boolean;
  hasGps: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`image-thumb${isSelected ? " image-thumb--selected" : ""}`}>
      <button
        type="button"
        className="image-thumb-select"
        aria-label={`View EXIF for ${fileName}`}
        aria-pressed={isSelected}
        onClick={onSelect}
      >
        <img src={objectUrl} alt="" className="image-thumb-img" />
        {hasGps && (
          <span className="image-thumb-gps" title="Contains GPS data" aria-label="GPS">
            📍
          </span>
        )}
      </button>
      <button
        type="button"
        className="image-thumb-remove"
        aria-label={`Remove ${fileName}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Privacy verdict banner ────────────────────────────────────────────────────

function PrivacyBanner({ exif }: { exif: Record<string, unknown> }) {
  const verdict = getPrivacyVerdict(exif);
  if (verdict.level === "clean") return null;

  const isHigh = verdict.level === "high";
  const reasonList = verdict.reasons.join(", ");

  return (
    <div className={`privacy-banner privacy-banner--${verdict.level}`} role="alert">
      <span className="privacy-banner-icon" aria-hidden="true">
        {isHigh ? "⚠" : "ℹ"}
      </span>
      <span className="privacy-banner-text">
        <strong>{isHigh ? "High privacy risk" : "Contains sensitive data"}</strong>
        {" — this photo exposes your "}
        {reasonList}.
      </span>
    </div>
  );
}

// ── EXIF table with sensitive-field grouping ──────────────────────────────────

function ExifTable({ exif }: { exif: Record<string, unknown> }) {
  const { copiedKey, flash } = useCopyFlash();

  const allKeys = Object.keys(exif).filter(
    (k) => !["latitude", "longitude", "GPSLatitude", "GPSLongitude"].includes(k)
  );

  const sensitiveKeys = allKeys.filter((k) => SENSITIVE_KEYS.has(k));
  const technicalKeys = allKeys.filter((k) => !SENSITIVE_KEYS.has(k));
  const sortedTechnical = sortExifKeys(technicalKeys);

  if (allKeys.length === 0) {
    return <p className="exif-empty">No metadata fields found.</p>;
  }

  const renderRow = (key: string) => {
    const val = formatExifValue(exif[key]);
    const copied = copiedKey === key;
    return (
      <tr key={key} className={`exif-row${SENSITIVE_KEYS.has(key) ? " exif-row--sensitive" : ""}`}>
        <th className="exif-key" scope="row">
          {key}
        </th>
        <td className="exif-val">
          <span className="exif-val-text">{val}</span>
          <button
            type="button"
            className={`exif-copy-btn${copied ? " exif-copy-btn--copied" : ""}`}
            aria-label={`Copy ${key}`}
            onClick={() => flash(key, val)}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </td>
      </tr>
    );
  };

  return (
    <table className="exif-table" aria-label="EXIF metadata">
      <tbody>
        {sensitiveKeys.length > 0 && (
          <>
            <tr className="exif-group-header">
              <th
                colSpan={2}
                scope="colgroup"
                className="exif-group-label exif-group-label--sensitive"
              >
                Sensitive
              </th>
            </tr>
            {sortExifKeys(sensitiveKeys).map(renderRow)}
          </>
        )}
        {sortedTechnical.length > 0 && (
          <>
            {sensitiveKeys.length > 0 && (
              <tr className="exif-group-header">
                <th colSpan={2} scope="colgroup" className="exif-group-label">
                  Technical
                </th>
              </tr>
            )}
            {sortedTechnical.map(renderRow)}
          </>
        )}
      </tbody>
    </table>
  );
}

// ── Metadata section label for XMP / IPTC ────────────────────────────────────

function MetaSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown> | null | undefined;
}) {
  const { copiedKey, flash } = useCopyFlash();
  if (!data || Object.keys(data).length === 0) return null;

  const keys = Object.keys(data).sort((a, b) => a.localeCompare(b));

  return (
    <div className="exif-section exif-section--secondary">
      <div className="exif-section-header">
        <span className="exif-section-title">{title}</span>
        <span className="exif-section-count">{keys.length} fields</span>
      </div>
      <table className="exif-table" aria-label={`${title} metadata`}>
        <tbody>
          {keys.map((key) => {
            const val = formatExifValue(data[key]);
            const copied = copiedKey === key;
            return (
              <tr key={key} className="exif-row">
                <th className="exif-key" scope="row">
                  {key}
                </th>
                <td className="exif-val">
                  <span className="exif-val-text">{val}</span>
                  <button
                    type="button"
                    className={`exif-copy-btn${copied ? " exif-copy-btn--copied" : ""}`}
                    aria-label={`Copy ${key}`}
                    onClick={() => flash(key, val)}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GpsCard({ lat, lon }: { lat: number; lon: number }) {
  const mapUrl = buildMapUrl(lat, lon);
  return (
    <div className="gps-card">
      <div className="gps-card-header">
        <span className="gps-badge">GPS</span>
        <span className="gps-coords">
          {lat.toFixed(6)}, {lon.toFixed(6)}
        </span>
      </div>
      <a href={mapUrl} target="_blank" rel="noreferrer" className="gps-map-link">
        View on Google Maps
      </a>
    </div>
  );
}

function StripPanel({
  entry,
  onStrip,
}: {
  entry: {
    id: string;
    file: File;
    cleanUrl: string | null;
    stripError: string | null;
    stripping?: boolean;
  };
  onStrip: (id: string) => void;
}) {
  const outputType = canvasOutputType(entry.file.type);
  const filename = cleanFilename(entry.file.name, outputType);

  // Trigger download when cleanUrl is set
  useEffect(() => {
    if (entry.cleanUrl) {
      const a = document.createElement("a");
      a.href = entry.cleanUrl;
      a.download = filename;
      a.click();
    }
  }, [entry.cleanUrl, filename]);

  return (
    <div className="strip-panel">
      <div className="strip-panel-header">
        <span className="strip-panel-label">Clean copy</span>
        <span className="strip-panel-hint">Canvas re-encode, all metadata removed</span>
      </div>
      {entry.cleanUrl ? (
        <span className="strip-downloaded-badge">Downloaded ✓</span>
      ) : (
        <button
          type="button"
          className="strip-btn"
          onClick={() => onStrip(entry.id)}
          disabled={entry.stripping}
          aria-label="Strip EXIF and download clean copy"
        >
          {entry.stripping ? "Stripping..." : "Strip & Download"}
        </button>
      )}
      {entry.stripError && (
        <p className="strip-error" role="alert" aria-live="assertive">
          {entry.stripError}
        </p>
      )}
    </div>
  );
}

// ── Export buttons ────────────────────────────────────────────────────────────

function ExportButtons({
  exif,
  xmp,
  iptc,
  filename,
}: {
  exif: Record<string, unknown> | null | undefined;
  xmp: Record<string, unknown> | null | undefined;
  iptc: Record<string, unknown> | null | undefined;
  filename: string;
}) {
  const base = exportBasename(filename);

  // Merge all metadata for export
  const merged: Record<string, unknown> = {};
  if (exif) Object.assign(merged, exif);
  if (xmp) {
    for (const [k, v] of Object.entries(xmp)) {
      merged[`xmp:${k}`] = v;
    }
  }
  if (iptc) {
    for (const [k, v] of Object.entries(iptc)) {
      merged[`iptc:${k}`] = v;
    }
  }

  if (Object.keys(merged).length === 0) return null;

  return (
    <div className="export-bar">
      <span className="export-bar-label">Export</span>
      <button
        type="button"
        className="export-btn"
        onClick={() =>
          downloadText(exifToJson(merged), `${base}-metadata.json`, "application/json")
        }
        title="Download all metadata as JSON"
      >
        JSON
      </button>
      <button
        type="button"
        className="export-btn"
        onClick={() => {
          const rows = Object.entries(merged)
            .map(([k, v]) => `${csvEscape(k)},${csvEscape(formatExifValue(v))}`)
            .join("\n");
          downloadText(`key,value\n${rows}`, `${base}-metadata.csv`, "text/csv");
        }}
        title="Download all metadata as CSV"
      >
        CSV
      </button>
    </div>
  );
}

function DetailPane() {
  const { images, selectedId, setClean, setStripError } = useExifStore();
  const { copiedKey: copiedJson, flash: flashJson } = useCopyFlash();
  const entry = images.find((i) => i.id === selectedId);
  const [stripping, setStripping] = useState(false);

  const handleStrip = useCallback(
    async (id: string) => {
      const img = images.find((i) => i.id === id);
      if (!img) return;
      setStripping(true);
      try {
        const outputType = canvasOutputType(img.file.type);
        const url = await stripExif(img.objectUrl, outputType);
        setClean(id, url);
      } catch (err) {
        setStripError(id, err instanceof Error ? err.message : "Strip failed");
      } finally {
        setStripping(false);
      }
    },
    [images, setClean, setStripError]
  );

  // Cmd/Ctrl+Enter triggers strip on the selected image
  useCmdEnter(() => {
        e.preventDefault();
        if (entry && !entry.cleanUrl && !stripping) {
          handleStrip(entry.id);
    };
    window.addEventListener("keydown", onKey);
  });

  if (!entry) {
    return (
      <div className="detail-empty">
        <p>Select an image to view its metadata.</p>
      </div>
    );
  }

  if (entry.loading) {
    return (
      <div className="detail-empty" role="status" aria-live="polite">
        <p>Reading metadata...</p>
      </div>
    );
  }

  const gps = entry.exif ? extractGps(entry.exif) : null;

  return (
    <div className="detail-pane">
      <div className="detail-preview">
        <img src={entry.objectUrl} alt={entry.file.name} className="detail-img" />
        <div className="detail-meta">
          <span className="detail-filename">{entry.file.name}</span>
          <span className="detail-filesize">{(entry.file.size / 1024).toFixed(1)} KB</span>
        </div>
      </div>

      {entry.exif && <PrivacyBanner exif={entry.exif} />}

      {gps && <GpsCard lat={gps.lat} lon={gps.lon} />}

      <StripPanel entry={{ ...entry, stripping }} onStrip={handleStrip} />

      <div className="exif-section">
        <div className="exif-section-header">
          <span className="exif-section-title">EXIF</span>
          {entry.exif && (
            <span className="exif-section-count">{Object.keys(entry.exif).length} fields</span>
          )}
          {entry.exif && Object.keys(entry.exif).length > 0 && (
            <button
              type="button"
              className={`copy-json-btn${copiedJson === "all" ? " copy-json-btn--copied" : ""}`}
              aria-label="Copy all metadata as JSON"
              onClick={() => flashJson("all", JSON.stringify(entry.exif, null, 2))}
            >
              {copiedJson === "all" ? "Copied!" : "Copy as JSON"}
            </button>
          )}
        </div>
        {entry.exif === null || entry.exif === undefined ? (
          <div className="exif-no-data">
            <p className="exif-empty">No EXIF metadata found in this file.</p>
            <p className="exif-no-data-hint">
              This can happen with screenshots, images exported from editing software, files shared
              through messaging apps, or PNGs (which rarely carry EXIF). The file may still be
              stripped cleanly above.
            </p>
          </div>
        ) : (
          <ExifTable exif={entry.exif} />
        )}
      </div>

      <MetaSection title="XMP" data={entry.xmp} />
      <MetaSection title="IPTC" data={entry.iptc} />

      <ExportButtons
        exif={entry.exif}
        xmp={entry.xmp}
        iptc={entry.iptc}
        filename={entry.file.name}
      />
    </div>
  );
}

// ── Batch strip + zip download ────────────────────────────────────────────────

function BatchStrip() {
  const { images, setClean, setStripError } = useExifStore();
  const [zipping, setZipping] = useState(false);

  const handleBatchStrip = useCallback(async () => {
    setZipping(true);
    // Strip all images that haven't been stripped yet
    const toStrip = images.filter((i) => !i.cleanUrl);
    await Promise.all(
      toStrip.map(async (img) => {
        try {
          const outputType = canvasOutputType(img.file.type);
          const url = await stripExif(img.objectUrl, outputType);
          setClean(img.id, url);
        } catch (err) {
          setStripError(img.id, err instanceof Error ? err.message : "Strip failed");
        }
      })
    );
    setZipping(false);
  }, [images, setClean, setStripError]);

  const handleDownloadZip = useCallback(async () => {
    setZipping(true);
    try {
      const { zipSync } = await import("fflate");
      const files: Record<string, Uint8Array> = {};

      await Promise.all(
        images.map(async (img) => {
          const url = img.cleanUrl;
          if (!url) return;
          const resp = await fetch(url);
          const buf = await resp.arrayBuffer();
          const outputType = canvasOutputType(img.file.type);
          const name = cleanFilename(img.file.name, outputType);
          files[name] = new Uint8Array(buf);
        })
      );

      const zipped = zipSync(files);
      const blob = new Blob([zipped], { type: "application/zip" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "clean-images.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("Zip failed:", err);
    } finally {
      setZipping(false);
    }
  }, [images]);

  if (images.length < 2) return null;

  const doneCount = images.filter((i) => i.cleanUrl).length;
  const allDone = doneCount === images.length;

  return (
    <div className="batch-strip">
      <span className="batch-strip-label">
        {allDone
          ? `All ${images.length} images stripped`
          : `${images.length} images loaded · ${doneCount} stripped`}
      </span>
      {!allDone && (
        <button
          type="button"
          className="batch-strip-btn"
          onClick={handleBatchStrip}
          disabled={zipping}
        >
          {zipping ? "Stripping..." : "Strip all"}
        </button>
      )}
      {allDone && (
        <button
          type="button"
          className="batch-strip-btn"
          onClick={handleDownloadZip}
          disabled={zipping}
        >
          {zipping ? "Zipping..." : "Download all as ZIP"}
        </button>
      )}
    </div>
  );
}

export function App() {
  const { images, selectedId, addImages, setExif, selectImage, removeImage, clearAll } =
    useExifStore();
  const [dropError, setDropError] = useState<string | null>(null);
  const dropErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showDropError = useCallback((msg: string) => {
    if (dropErrorTimer.current) clearTimeout(dropErrorTimer.current);
    setDropError(msg);
    dropErrorTimer.current = setTimeout(() => setDropError(null), 3000);
  }, []);

  const handleUnsupported = useCallback(() => {
    showDropError("Unsupported file — drop an image.");
  }, [showDropError]);

  // Parse EXIF/XMP/IPTC for any newly-added images (loading=true, exif=undefined)
  useEffect(() => {
    const pending = images.filter((img) => img.loading && img.exif === undefined);
    for (const img of pending) {
      parseExif(img.file).then(({ exif, xmp, iptc }) => setExif(img.id, exif, xmp, iptc));
    }
  }, [images, setExif]);

  return (
    <div className="app-root">
      <Header title="EXIF" subtitle="view and remove photo metadata" brandMark={<BrandMark />} />

      <main className="site-main">
        {dropError && (
          <p className="drop-error-msg" role="alert">
            {dropError}
          </p>
        )}
        {images.length === 0 ? (
          <div className="welcome-section">
            <DropZone onFiles={addImages} onUnsupported={handleUnsupported} />
            <div className="welcome-features">
              <div className="feature-chip">
                <span className="feature-chip-icon">🔍</span>
                <span>EXIF, XMP + IPTC</span>
              </div>
              <div className="feature-chip">
                <span className="feature-chip-icon">📍</span>
                <span>GPS with map link</span>
              </div>
              <div className="feature-chip">
                <span className="feature-chip-icon">🧹</span>
                <span>Strip &amp; download clean</span>
              </div>
              <div className="feature-chip">
                <span className="feature-chip-icon">🔒</span>
                <span>No upload, stays in your browser</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="workspace">
            <div className="sidebar">
              <div className="sidebar-toolbar">
                <DropZone onFiles={addImages} onUnsupported={handleUnsupported} />
                <button
                  type="button"
                  className="clear-btn"
                  onClick={clearAll}
                  aria-label="Clear all images"
                >
                  Clear all
                </button>
              </div>
              <ul className="thumb-grid" aria-label="Loaded images">
                {images.map((img) => (
                  <li key={img.id}>
                    <ImageThumb
                      id={img.id}
                      objectUrl={img.objectUrl}
                      fileName={img.file.name}
                      isSelected={img.id === selectedId}
                      hasGps={!!(img.exif && extractGps(img.exif))}
                      onSelect={() => selectImage(img.id)}
                      onRemove={() => removeImage(img.id)}
                    />
                  </li>
                ))}
              </ul>
              <BatchStrip />
            </div>
            <div className="main-panel">
              <DetailPane />
            </div>
          </div>
        )}
      </main>

      <Footer blurb="No upload. Runs entirely in your browser." />
    </div>
  );
}
