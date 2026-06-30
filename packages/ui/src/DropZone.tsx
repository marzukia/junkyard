import { useRef, useState } from "react";

interface DropZoneProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** aria-label for the drop zone button */
  label: string;
  /** Disable drop/file interactions */
  disabled?: boolean;
  /** Extra classes (appended to base .dropzone class) */
  className?: string;
  /** Custom icon node (default: upload arrow SVG) */
  icon?: React.ReactNode;
  /** Custom children to render inside the button/label after the icon.
   *  If omitted, renders default label + optional sublabel. */
  children?: React.ReactNode;
  /** Render as <label> instead of <button> (some apps wrap hidden input differently) */
  asLabel?: boolean;
}

export function DropZone({
  accept,
  multiple = false,
  onFiles,
  label,
  disabled = false,
  className = "",
  icon,
  children,
  asLabel = false,
}: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (files: FileList | null) => {
    if (!files || disabled) return;
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

  const baseClass = `dropzone${dragging ? " dropzone--active" : ""}${disabled ? " dropzone--disabled" : ""}${className ? ` ${className}` : ""}`;

  const dragHandlers = {
    onClick: () => inputRef.current?.click(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (!disabled) handle(e.dataTransfer.files);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      tabIndex={-1}
      style={{ display: "none" }}
      onChange={(e) => handle(e.target.files)}
      aria-hidden="true"
    />
  );

  const defaultIcon = icon ?? <UploadIcon />;

  if (asLabel) {
    return (
      <label className={baseClass} aria-label={label} {...dragHandlers}>
        {input}
        {defaultIcon}
        {children ?? (
          <>
            <span className="dropzone-label">{label}</span>
          </>
        )}
      </label>
    );
  }

  return (
    <button type="button" className={baseClass} aria-label={label} {...dragHandlers}>
      {input}
      {defaultIcon}
      {children ?? (
        <>
          <span className="dropzone-label">{label}</span>
        </>
      )}
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
