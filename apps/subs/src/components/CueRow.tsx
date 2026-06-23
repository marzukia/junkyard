import { useCallback } from "react";
import { formatTimestampSrt, parseTimestamp } from "../lib/subtitle";
import { useSubsStore } from "../store/useSubsStore";

interface CueRowProps {
  id: string;
  index: number;
}

export function CueRow({ id, index }: CueRowProps) {
  const cue = useSubsStore((s) => s.cues.find((c) => c.id === id));
  const selected = useSubsStore((s) => s.selectedIds.has(id));
  const updateCue = useSubsStore((s) => s.updateCue);
  const deleteCue = useSubsStore((s) => s.deleteCue);
  const toggleSelect = useSubsStore((s) => s.toggleSelect);

  const handleTimestamp = useCallback(
    (field: "startMs" | "endMs", value: string) => {
      try {
        const ms = parseTimestamp(value);
        updateCue(id, { [field]: ms });
      } catch {
        // leave invalid input without updating — user is mid-type
      }
    },
    [id, updateCue]
  );

  if (!cue) return null;

  return (
    <li className={`cue-row${selected ? " cue-row--selected" : ""}`}>
      <button
        type="button"
        className={`cue-row__check${selected ? " cue-row__check--on" : ""}`}
        onClick={() => toggleSelect(id)}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} cue ${index + 1}`}
      >
        {selected ? "✓" : ""}
      </button>

      <span className="cue-row__num mono-label">{index + 1}</span>

      <div className="cue-row__timings">
        <input
          type="text"
          className="cue-row__ts"
          defaultValue={formatTimestampSrt(cue.startMs)}
          key={`${id}-start-${cue.startMs}`}
          onBlur={(e) => handleTimestamp("startMs", e.target.value)}
          aria-label={`Start time for cue ${index + 1}`}
        />
        <span className="cue-row__arrow" aria-hidden="true">
          →
        </span>
        <input
          type="text"
          className="cue-row__ts"
          defaultValue={formatTimestampSrt(cue.endMs)}
          key={`${id}-end-${cue.endMs}`}
          onBlur={(e) => handleTimestamp("endMs", e.target.value)}
          aria-label={`End time for cue ${index + 1}`}
        />
      </div>

      <textarea
        className="cue-row__text"
        defaultValue={cue.text}
        key={`${id}-text-${cue.text.slice(0, 20)}`}
        rows={cue.text.split("\n").length}
        onBlur={(e) => updateCue(id, { text: e.target.value })}
        aria-label={`Text for cue ${index + 1}`}
      />

      <button
        type="button"
        className="cue-row__delete"
        onClick={() => deleteCue(id)}
        aria-label={`Delete cue ${index + 1}`}
        title="Delete cue"
      >
        ×
      </button>
    </li>
  );
}
