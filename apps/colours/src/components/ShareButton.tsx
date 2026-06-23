import { useCallback, useState } from "react";

function LinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

type CopyState = "idle" | "copied" | "error";

export function ShareButton() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 1600);
    }
  }, []);

  const label = copyState === "copied" ? "Copied!" : copyState === "error" ? "Error" : "Copy link";

  return (
    <button
      type="button"
      className="share-btn"
      onClick={handleShare}
      aria-label="Copy shareable link to clipboard"
      title="Copy a link that restores this exact state"
    >
      <LinkIcon />
      <span>{label}</span>
    </button>
  );
}
