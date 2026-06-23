import { useFaviconStore } from "../lib/faviconStore";

export function PreviewGrid() {
  const { previews } = useFaviconStore();

  if (previews.length === 0) return null;

  return (
    <div className="card">
      <span className="section-label">Preview</span>
      <div className="preview-grid">
        {previews.map((entry) => (
          <div key={entry.size} className="preview-tile">
            <img
              src={entry.dataUrl}
              alt={`${entry.label} favicon preview`}
              width={Math.min(entry.size, 64)}
              height={Math.min(entry.size, 64)}
              className="preview-tile__canvas"
              style={{
                width: `${Math.min(entry.size, 64)}px`,
                height: `${Math.min(entry.size, 64)}px`,
              }}
            />
            <span className="preview-tile__label">{entry.label}</span>
            <span className="preview-tile__label" style={{ opacity: 0.6 }}>
              {entry.filename}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
