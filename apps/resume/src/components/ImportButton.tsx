import { useRef, useState } from "react";
import { useResumeStore } from "../store/useResumeStore";

type ImportStatus = "idle" | "busy" | "done" | "error";

/**
 * File import button. Accepts .json files in either our internal format
 * or the JSON Resume standard schema (https://jsonresume.org/schema/).
 */
export function ImportButton() {
  const loadFromJson = useResumeStore((s) => s.loadFromJson);
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    fileInputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so the same file can be re-imported if needed
    e.target.value = "";

    if (!file.name.endsWith(".json")) {
      setError("Please select a .json file.");
      setStatus("error");
      return;
    }

    setStatus("busy");
    setError(null);

    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const result = loadFromJson(raw);
      if (!result.ok) {
        setError(result.error ?? "Could not parse the file.");
        setStatus("error");
        return;
      }
      setStatus("done");
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setError("Invalid JSON file.");
      setStatus("error");
    }
  }

  const label =
    status === "busy" ? "Importing..." : status === "done" ? "Imported!" : "Import JSON";

  return (
    <div className="export-actions">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: "none" }}
        onChange={handleFile}
        tabIndex={-1}
      />
      <button
        type="button"
        className={`btn-secondary${status === "done" ? " btn-secondary--done" : ""}`}
        onClick={handleClick}
        disabled={status === "busy"}
        aria-busy={status === "busy"}
        title="Import from a saved JSON file or JSON Resume schema"
      >
        {label}
      </button>
      {status === "error" && error && (
        <output role="alert" style={{ fontSize: "0.8rem", color: "#c0392b" }}>
          {error}
        </output>
      )}
    </div>
  );
}
