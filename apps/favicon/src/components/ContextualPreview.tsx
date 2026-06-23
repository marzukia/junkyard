import { useFaviconStore } from "../lib/faviconStore";

/** Realistic browser-context previews so users see how the favicon looks at tiny sizes */
export function ContextualPreview() {
  const { previews } = useFaviconStore();

  if (previews.length === 0) return null;

  // Pick the 16px and 32px previews for tab/bookmark, 192px for maskable
  const p16 = previews.find((p) => p.size === 16);
  const p32 = previews.find((p) => p.size === 32);
  const p192 = previews.find((p) => p.size === 192);

  if (!p16 && !p32) return null;
  const tabSrc = p16?.dataUrl ?? p32?.dataUrl ?? "";
  const bookmarkSrc = p32?.dataUrl ?? p16?.dataUrl ?? "";

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <span className="section-label">Context preview</span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "flex-start" }}>
        {/* Browser tab mock */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.58rem",
              color: "var(--ink-faint)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Browser tab
          </span>

          {/* Light tab */}
          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: 0,
              borderRadius: "8px 8px 0 0",
              overflow: "hidden",
              border: "1px solid #d0d5da",
              borderBottom: "none",
              background: "#ffffff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px 6px 10px",
                background: "#ffffff",
                minWidth: "160px",
                maxWidth: "200px",
              }}
            >
              <img
                src={tabSrc}
                alt="16px favicon in light tab"
                width={16}
                height={16}
                style={{
                  width: "16px",
                  height: "16px",
                  imageRendering: "auto",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: "12px",
                  color: "#1f2937",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                My App
              </span>
              <span style={{ fontSize: "11px", color: "#9aa3ac", flexShrink: 0 }}>x</span>
            </div>
          </div>

          {/* Dark tab */}
          <div
            style={{
              display: "inline-flex",
              borderRadius: "8px 8px 0 0",
              overflow: "hidden",
              border: "1px solid #374151",
              borderBottom: "none",
              background: "#1f2937",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px 6px 10px",
                minWidth: "160px",
                maxWidth: "200px",
              }}
            >
              <img
                src={tabSrc}
                alt="16px favicon in dark tab"
                width={16}
                height={16}
                style={{
                  width: "16px",
                  height: "16px",
                  imageRendering: "auto",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  fontSize: "12px",
                  color: "#e5e7eb",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                My App
              </span>
              <span style={{ fontSize: "11px", color: "#6b7280", flexShrink: 0 }}>x</span>
            </div>
          </div>
        </div>

        {/* Bookmark bar mock */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.58rem",
              color: "var(--ink-faint)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Bookmark bar
          </span>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              background: "#f3f4f6",
              border: "1px solid #d0d5da",
              borderRadius: "6px",
              maxWidth: "160px",
            }}
          >
            <img
              src={bookmarkSrc}
              alt="16px favicon in bookmark"
              width={16}
              height={16}
              style={{
                width: "16px",
                height: "16px",
                imageRendering: "auto",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "system-ui, -apple-system, sans-serif",
                fontSize: "12px",
                color: "#374151",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              My App
            </span>
          </div>
        </div>

        {/* Android maskable circle */}
        {p192 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                color: "var(--ink-faint)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Android maskable
            </span>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {/* Circle mask */}
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  background: "#e5e7eb",
                  flexShrink: 0,
                }}
              >
                <img
                  src={p192.dataUrl}
                  alt="Android circle-masked icon"
                  width={48}
                  height={48}
                  style={{ width: "100%", height: "100%", imageRendering: "auto" }}
                />
              </div>
              {/* Squircle mask */}
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "30%",
                  overflow: "hidden",
                  background: "#e5e7eb",
                  flexShrink: 0,
                }}
              >
                <img
                  src={p192.dataUrl}
                  alt="Android squircle-masked icon"
                  width={48}
                  height={48}
                  style={{ width: "100%", height: "100%", imageRendering: "auto" }}
                />
              </div>
            </div>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.58rem",
                color: "var(--ink-faint)",
              }}
            >
              circle / squircle masks
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
