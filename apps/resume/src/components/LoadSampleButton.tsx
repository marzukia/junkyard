import { useResumeStore } from "../store/useResumeStore";

interface LoadSampleButtonProps {
  /** "primary" = solid pill (for header); "secondary" = outlined (for empty state) */
  variant?: "primary" | "secondary";
}

export function LoadSampleButton({ variant = "secondary" }: LoadSampleButtonProps) {
  const loadSample = useResumeStore((s) => s.loadSample);

  return (
    <button
      type="button"
      className={variant === "primary" ? "btn-primary" : "btn-secondary"}
      onClick={loadSample}
      title="Fill in a sample resume to see the output format"
    >
      Load sample
    </button>
  );
}
