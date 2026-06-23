import { useState } from "react";
import { buildMetaSnippet } from "../ogLogic";

interface MetaSnippetProps {
  title: string;
  description: string;
  width: number;
  height: number;
}

/**
 * Shows a ready-to-paste HTML meta tag snippet after export.
 * The user pastes their hosted image URL to complete it.
 */
export function MetaSnippet({ title, description, width, height }: MetaSnippetProps) {
  const [imageUrl, setImageUrl] = useState("https://yourdomain.com/og-image.png");
  const [copied, setCopied] = useState(false);

  const snippet = buildMetaSnippet(title, description, imageUrl, width, height);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea
    }
  }

  return (
    <div className="og-meta-snippet">
      <div className="og-meta-header">
        <span className="og-meta-label">Meta tags</span>
        <span className="og-meta-hint">Paste into your page &lt;head&gt;</span>
      </div>

      <div className="og-field" style={{ marginBottom: "0.5rem" }}>
        <label htmlFor="og-meta-url">Image URL (after you host the PNG)</label>
        <input
          type="url"
          id="og-meta-url"
          className="og-input"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://yourdomain.com/og-image.png"
          spellCheck={false}
        />
      </div>

      <div className="og-meta-code-wrap">
        <pre className="og-meta-code">{snippet}</pre>
        <button
          type="button"
          className={`og-meta-copy${copied ? " og-meta-copy--ok" : ""}`}
          onClick={handleCopy}
          aria-label="Copy meta tags"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
