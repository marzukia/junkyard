import type { ImageWarning } from "../lib/faviconCore";

const WARNING_MESSAGES: Record<ImageWarning, { title: string; tip: string }> = {
  "non-square": {
    title: "Non-square image",
    tip: "Favicons are square. Add background + padding to avoid cropping.",
  },
  "too-small": {
    title: "Image smaller than 512px",
    tip: "Small sources produce blurry large icons. Use a 512px or larger image for best results.",
  },
  "low-contrast": {
    title: "Low contrast detected",
    tip: "The icon may disappear on similar-coloured backgrounds. Add a background colour.",
  },
};

export function ImageWarnings({ warnings }: { warnings: ImageWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
      {warnings.map((w) => {
        const { title, tip } = WARNING_MESSAGES[w];
        return (
          <div
            key={w}
            style={{
              display: "flex",
              gap: "0.5rem",
              padding: "0.55rem 0.75rem",
              background: "rgba(232, 176, 75, 0.1)",
              border: "1px solid rgba(232, 176, 75, 0.35)",
              borderRadius: "var(--radius-sm)",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                lineHeight: 1.3,
                flexShrink: 0,
                marginTop: "1px",
              }}
              aria-hidden="true"
            >
              !
            </span>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: "#b8882a",
                  letterSpacing: "0.02em",
                  marginBottom: "0.15rem",
                }}
              >
                {title}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.62rem",
                  color: "var(--ink-mid)",
                  lineHeight: 1.45,
                }}
              >
                {tip}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
