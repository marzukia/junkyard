import { useFaviconStore } from "../lib/faviconStore";

const EMOJI_PRESETS = ["🚀", "💎", "⚡", "🔥", "🌿", "🎯", "🛡", "✦", "★", "♻"];
const LETTER_PRESETS = ["A", "B", "G", "M", "S", "W"];

export function TextEmojiInput({ mode }: { mode: "text" | "emoji" }) {
  const { sourceText, setSourceText } = useFaviconStore();
  const presets = mode === "emoji" ? EMOJI_PRESETS : LETTER_PRESETS;
  const maxLen = mode === "emoji" ? 2 : 2;
  const placeholder = mode === "emoji" ? "🚀" : "AB";
  const hint =
    mode === "emoji" ? "1-2 emoji to render as your favicon" : "1-2 letters (initials work great)";

  return (
    <div>
      <span className="section-label">{mode === "emoji" ? "Emoji" : "Text / initials"}</span>

      <div
        style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", marginBottom: "0.75rem" }}
      >
        <input
          type="text"
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value.slice(0, maxLen))}
          placeholder={placeholder}
          maxLength={maxLen}
          aria-label={`${mode === "emoji" ? "Emoji" : "Text"} for favicon`}
          style={{
            flex: 1,
            padding: "0.7rem 0.8rem",
            fontFamily: mode === "emoji" ? "system-ui, sans-serif" : "var(--font-mono)",
            fontSize: mode === "emoji" ? "28px" : "20px",
            lineHeight: 1,
            border: "1px solid var(--rule)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface)",
            color: "var(--ink)",
            outline: "none",
            textAlign: "center",
          }}
        />
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.62rem",
          color: "var(--ink-faint)",
          marginBottom: "0.75rem",
        }}
      >
        {hint}
      </p>

      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setSourceText(p)}
            title={`Use "${p}"`}
            style={{
              fontFamily: mode === "emoji" ? "system-ui, sans-serif" : "var(--font-mono)",
              fontSize: mode === "emoji" ? "18px" : "13px",
              padding: "0.25rem 0.55rem",
              border: `1px solid ${sourceText === p ? "var(--accent)" : "var(--rule)"}`,
              borderRadius: "var(--radius-sm)",
              background: sourceText === p ? "var(--accent-soft)" : "var(--surface-sunken)",
              color: sourceText === p ? "var(--accent)" : "var(--ink-mid)",
              cursor: "pointer",
              transition: "border-color 0.12s, background 0.12s",
              lineHeight: 1.3,
              minWidth: "2.2rem",
              textAlign: "center",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
