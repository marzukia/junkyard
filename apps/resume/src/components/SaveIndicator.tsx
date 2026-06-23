import { useEffect, useRef, useState } from "react";
import { useResumeStore } from "../store/useResumeStore";

/**
 * Shows a brief "Saving..." → "Saved" indicator whenever the store changes,
 * and a "Clear / Start over" button with a confirmation step.
 *
 * The indicator sits near the export button (rendered inside header-controls).
 * It is deliberately small and low-contrast so it doesn't compete with the PDF button.
 */
export function SaveIndicator() {
  const s = useResumeStore();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirming, setConfirming] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Destructure only the data fields so the effect fires on data changes, not
  // on action-function identity churn.
  const {
    fullName,
    email,
    phone,
    location,
    linkedin,
    website,
    summary,
    experience,
    education,
    skills,
  } = s;

  // biome-ignore lint/correctness/useExhaustiveDependencies: tracking all data fields intentionally; actions are excluded
  useEffect(() => {
    // Skip the very first render (hydration from localStorage)
    if (saveTimer.current === null && status === "idle") {
      // Arm the timer — future changes will trigger the indicator
      saveTimer.current = setTimeout(() => {}, 0);
      return;
    }

    setStatus("saving");

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setStatus("saved");
      saveTimer.current = setTimeout(() => setStatus("idle"), 2000);
    }, 400);
  }, [fullName, email, phone, location, linkedin, website, summary, experience, education, skills]);

  function handleClearClick() {
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel confirmation after 5 s
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirming(false), 5000);
    } else {
      setConfirming(false);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      s.resetAll();
      setStatus("idle");
    }
  }

  return (
    <div className="save-indicator">
      {status !== "idle" && (
        <span className={`save-status save-status--${status}`} aria-live="polite">
          {status === "saving" ? "Saving…" : "Saved"}
        </span>
      )}
      <button
        type="button"
        className={`btn-secondary btn-clear${confirming ? " btn-clear--confirm" : ""}`}
        onClick={handleClearClick}
        title="Clear all data and start over"
      >
        {confirming ? "Confirm clear?" : "Clear"}
      </button>
    </div>
  );
}
