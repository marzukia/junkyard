import JSZip from "jszip";
import { useCallback, useRef, useState } from "react";
import { BATCH_MAX_ROWS, parseBatchInput } from "../lib/batch";
import type { BatchItem } from "../lib/batch";
import type { DotStyle, ErrorCorrectionLevel, EyeStyle } from "../lib/qr";
import { renderQRToCanvas } from "../lib/qr";

interface BatchModeProps {
  fgColor: string;
  bgColor: string;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
}

interface PreviewEntry {
  item: BatchItem;
  dataUrl: string;
}

export function BatchMode({
  fgColor,
  bgColor,
  errorCorrectionLevel,
  dotStyle,
  eyeStyle,
}: BatchModeProps) {
  const [rawInput, setRawInput] = useState("");
  const [previews, setPreviews] = useState<PreviewEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawInput(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setCapNotice(null);
    setPreviews([]);

    const { items, cappedAt, skippedRows } = parseBatchInput(rawInput);

    if (items.length === 0) {
      setError("No valid rows found. Add one URL or value per line, or use label,content format.");
      return;
    }

    const notices: string[] = [];
    if (cappedAt !== null) {
      notices.push(
        `Capped at ${BATCH_MAX_ROWS} rows. ${skippedRows.length > 0 ? `${skippedRows.length} empty rows also skipped.` : ""}`
      );
    } else if (skippedRows.length > 0) {
      notices.push(
        `${skippedRows.length} row${skippedRows.length !== 1 ? "s" : ""} skipped (empty content).`
      );
    }
    if (notices.length > 0) setCapNotice(notices.join(" "));

    setGenerating(true);
    const results: PreviewEntry[] = [];

    for (const item of items) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        await renderQRToCanvas(canvas, {
          text: item.content,
          fgColor,
          bgColor,
          errorCorrectionLevel,
          dotStyle,
          eyeStyle,
        });
        results.push({ item, dataUrl: canvas.toDataURL("image/png") });
      } catch {
        // Skip items that can't be encoded (e.g. content too long)
      }
    }

    setGenerating(false);

    if (results.length === 0) {
      setError(
        "None of the rows could be encoded as QR codes. Check that content is not too long."
      );
      return;
    }

    setPreviews(results);
  }, [rawInput, fgColor, bgColor, errorCorrectionLevel, dotStyle, eyeStyle]);

  const handleDownloadZip = useCallback(async () => {
    if (previews.length === 0) return;
    setZipping(true);

    try {
      const zip = new JSZip();

      // Track used filenames to avoid collisions
      const usedNames = new Map<string, number>();

      for (const entry of previews) {
        const baseName = entry.item.label;
        const count = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, count + 1);
        const fileName = count === 0 ? `${baseName}.png` : `${baseName}_${count}.png`;

        // Convert dataUrl to binary
        const base64 = entry.dataUrl.split(",")[1];
        zip.file(fileName, base64, { base64: true });
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "qr-codes.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setError("Failed to create ZIP file.");
    } finally {
      setZipping(false);
    }
  }, [previews]);

  const hasInput = rawInput.trim().length > 0;
  const hasPreviews = previews.length > 0;

  return (
    <div className="batch-root">
      <div className="qr-field-group">
        <label className="qr-field-label" htmlFor="batch-input">
          Content (one per line, or label,content)
        </label>
        <textarea
          id="batch-input"
          className="qr-text-input batch-textarea"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={"https://example.com\nhttps://other.com\nOr: My Product,https://product.com"}
          aria-label="Batch QR input"
        />
      </div>

      <div className="batch-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          style={{ display: "none" }}
          aria-label="Upload CSV or TXT file"
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload .csv / .txt
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={() => void handleGenerate()}
          disabled={!hasInput || generating}
        >
          {generating ? "Generating..." : "Generate QR codes"}
        </button>
      </div>

      {error && (
        <p className="qr-error-msg" role="alert">
          {error}
        </p>
      )}

      {capNotice && (
        // biome-ignore lint/a11y/useSemanticElements: <output> doesn't carry the same semantic meaning here; <p> with role="status" is intentional for live region
        <p className="batch-cap-notice" role="status">
          {capNotice}
        </p>
      )}

      {hasPreviews && (
        <>
          <div className="batch-summary">
            <span className="batch-count">
              {previews.length} QR code{previews.length !== 1 ? "s" : ""} ready
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleDownloadZip()}
              disabled={zipping}
              aria-label="Download all QR codes as a ZIP file"
            >
              {zipping ? "Zipping..." : "Download all (ZIP)"}
            </button>
          </div>

          <div className="batch-grid" aria-label="QR code previews">
            {previews.map((entry) => (
              <div key={`${entry.item.label}-${entry.item.content}`} className="batch-item">
                <img
                  src={entry.dataUrl}
                  alt={`QR code for ${entry.item.label}`}
                  className="batch-preview-img"
                  loading="lazy"
                />
                <span className="batch-item-label" title={entry.item.content}>
                  {entry.item.label}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
