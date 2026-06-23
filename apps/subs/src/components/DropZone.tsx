import { useRef, useState } from "react";
import { useSubsStore } from "../store/useSubsStore";

/** A short but realistic sample SRT used when the user hits "Try a sample". */
const SAMPLE_SRT = `1
00:00:02,000 --> 00:00:04,500
Hey, welcome to the demo.

2
00:00:05,000 --> 00:00:07,200
This is a sample subtitle file
you can edit right now.

3
00:00:08,000 --> 00:00:10,000
Shift the timing, fix overlaps,
then download as .srt or .vtt.

4
00:00:11,200 --> 00:00:13,500
Enjoy!
`;

export function DropZone() {
  const loadRaw = useSubsStore((s) => s.loadRaw);
  const loadError = useSubsStore((s) => s.loadError);
  const clearLoadError = useSubsStore((s) => s.clearLoadError);
  const [dragging, setDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") loadRaw(text, file.name);
    };
    reader.readAsText(file, "utf-8");
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
    // reset so same file can be re-selected after error
    e.target.value = "";
  }

  function loadSample() {
    loadRaw(SAMPLE_SRT, "sample.srt");
  }

  function submitPaste() {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setPasteError(true);
      return;
    }
    setPasteError(false);
    loadRaw(trimmed, "pasted.srt");
  }

  // Cmd/Ctrl+Enter in paste mode submits
  function onPasteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submitPaste();
    }
  }

  // Clear error when user re-interacts
  function dismissError() {
    clearLoadError();
    inputRef.current?.click();
  }

  if (loadError) {
    return (
      <div className="drop-zone-wrapper">
        <div className="drop-zone drop-zone--error" role="alert">
          <ErrorGlyph />
          <p className="drop-zone__title drop-zone__title--error">{loadError}</p>
          <p className="drop-zone__hint">Supported: .srt, .vtt, .ass, .ssa, .sbv</p>
        </div>
        <div className="drop-zone-alts">
          <button type="button" className="btn-primary" onClick={dismissError}>
            Try another file
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              clearLoadError();
              setPasteMode(true);
            }}
          >
            Paste text
          </button>
        </div>
        {/* Hidden file input for "Try another file" */}
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.sbv"
          style={{ display: "none" }}
          onChange={onFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    );
  }

  if (pasteMode) {
    return (
      <div className="drop-zone drop-zone--paste">
        <p className="drop-zone__title" style={{ marginBottom: "0.75rem" }}>
          Paste subtitle text
        </p>
        <textarea
          className="paste-input"
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPasteError(false);
          }}
          onKeyDown={onPasteKeyDown}
          placeholder={"1\n00:00:01,000 --> 00:00:03,000\nYour subtitle text here"}
          aria-label="Paste SRT or VTT text"
          // biome-ignore lint/a11y/noAutofocus: intentional -- user clicked to enter paste mode
          autoFocus
        />
        {pasteError && (
          <span className="paste-error" role="alert">
            Paste some subtitle text first
          </span>
        )}
        <div className="paste-actions">
          <button type="button" className="btn-primary" onClick={submitPaste}>
            Load
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setPasteMode(false);
              setPasteText("");
              setPasteError(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="drop-zone-wrapper">
      <label
        className={`drop-zone${dragging ? " drop-zone--over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label="Drop .srt, .vtt, .ass, or .sbv file here, or click to browse"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".srt,.vtt,.ass,.ssa,.sbv"
          style={{ display: "none" }}
          onChange={onFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <SubsGlyph />
        <p className="drop-zone__title">Drop .srt, .vtt, .ass, or .sbv here</p>
        <p className="drop-zone__hint">
          or click to browse. Stays in your browser, never uploaded.
        </p>
      </label>

      <div className="drop-zone-alts">
        <button type="button" className="btn-secondary" onClick={() => setPasteMode(true)}>
          Paste text
        </button>
        <button type="button" className="btn-secondary" onClick={loadSample}>
          Try a sample
        </button>
      </div>
    </div>
  );
}

function SubsGlyph() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ marginBottom: "0.75rem" }}
    >
      {/* Subtitle lines */}
      <rect x="10" y="17" width="28" height="5" rx="2.5" fill="var(--accent)" />
      <rect x="14" y="26" width="20" height="5" rx="2.5" fill="#e8b04b" />
      {/* Corner accent dots */}
      <rect x="6" y="6" width="6" height="6" rx="1.5" fill="#d9594c" />
      <rect x="36" y="6" width="6" height="6" rx="1.5" fill="#d9594c" />
      <rect x="6" y="36" width="6" height="6" rx="1.5" fill="#d9594c" />
      <rect x="36" y="36" width="6" height="6" rx="1.5" fill="#d9594c" />
    </svg>
  );
}

function ErrorGlyph() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ marginBottom: "0.75rem" }}
    >
      <circle cx="24" cy="24" r="18" stroke="#d9594c" strokeWidth="2.5" />
      <line
        x1="24"
        y1="14"
        x2="24"
        y2="27"
        stroke="#d9594c"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="24" cy="33" r="2" fill="#d9594c" />
    </svg>
  );
}
