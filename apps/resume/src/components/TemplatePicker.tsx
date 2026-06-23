import type { TemplateId } from "../store/useResumeStore";
import { useResumeStore } from "../store/useResumeStore";

const TEMPLATES: { id: TemplateId; label: string; accent: string }[] = [
  { id: "clean", label: "Clean", accent: "#2f9d8d" },
  { id: "compact", label: "Compact", accent: "#5b6acc" },
  { id: "bold", label: "Bold", accent: "#c0392b" },
];

export function TemplatePicker() {
  const template = useResumeStore((s) => s.template);
  const setTemplate = useResumeStore((s) => s.setTemplate);

  return (
    <div className="space-toggle-wrapper">
      <span className="space-toggle-label" id="template-picker-label">
        Style
      </span>
      <div className="space-toggle" aria-labelledby="template-picker-label">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`space-btn${template === t.id ? " space-btn--active" : ""}`}
            onClick={() => setTemplate(t.id)}
            aria-pressed={template === t.id}
            style={
              template === t.id
                ? ({ "--template-active-accent": t.accent } as React.CSSProperties)
                : undefined
            }
          >
            <span className="template-dot" style={{ background: t.accent }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
