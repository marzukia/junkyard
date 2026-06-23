import { useRef, useState } from "react";

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
  sublabel?: string;
}

export function DropZone({ accept, multiple = false, onFiles, label, sublabel }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const filtered = arr.filter((f) => {
      const mt = f.type;
      return accept.split(",").some((a) => {
        const t = a.trim();
        if (t.startsWith(".")) return f.name.toLowerCase().endsWith(t);
        if (t.endsWith("/*")) return mt.startsWith(t.replace("/*", ""));
        return mt === t;
      });
    });
    const first = filtered[0];
    if (filtered.length > 0 && first) onFiles(multiple ? filtered : [first]);
  };

  return (
    <button
      type="button"
      className={`dropzone${dragging ? " dropzone--active" : ""}`}
      aria-label={label}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        tabIndex={-1}
        style={{ display: "none" }}
        onChange={(e) => handle(e.target.files)}
      />
      <span className="dropzone-icon" aria-hidden="true">
        <UploadIcon />
      </span>
      <span className="dropzone-label">{label}</span>
      {sublabel && <span className="dropzone-sublabel">{sublabel}</span>}
    </button>
  );
}

function UploadIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
