import { useMemo } from "react";

interface Props {
  text: string;
  lowConfWords: Array<{ text: string; confidence: number }>;
}

/**
 * Read-only view of OCR text with low-confidence words highlighted in amber.
 * The highlight is by word match (case-insensitive, punctuation-stripped).
 * Not a substitute for the editable textarea -- user switches back to edit.
 */
export function WordHighlightView({ text, lowConfWords }: Props) {
  // Build a Set of normalised uncertain word forms for fast lookup
  const uncertainSet = useMemo(() => {
    const set = new Set<string>();
    for (const w of lowConfWords) {
      set.add(w.text.toLowerCase().replace(/[^a-z0-9]/g, ""));
    }
    return set;
  }, [lowConfWords]);

  const segments = useMemo(() => {
    // Split text into word / whitespace / punctuation tokens, keep delimiters
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, i) => {
      const norm = token.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isUncertain = norm.length > 0 && uncertainSet.has(norm);
      return { token, isUncertain, key: i };
    });
  }, [text, uncertainSet]);

  return (
    <div
      className="ocr-highlight-view"
      aria-label="Extracted text with low-confidence words highlighted"
    >
      <p className="ocr-highlight-legend">
        <span className="ocr-highlight-word">highlighted words</span> had lower recognition
        confidence
      </p>
      <pre className="ocr-highlight-pre">
        {segments.map(({ token, isUncertain, key }) =>
          isUncertain ? (
            <mark key={key} className="ocr-highlight-word" title="Low-confidence word">
              {token}
            </mark>
          ) : (
            <span key={key}>{token}</span>
          )
        )}
      </pre>
    </div>
  );
}
