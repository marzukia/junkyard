import { useSubsStore } from "../store/useSubsStore";
import { CueRow } from "./CueRow";

export function CueList() {
  const cues = useSubsStore((s) => s.cues);

  if (cues.length === 0) {
    return (
      <div className="cue-list-empty card">
        <p>No cues loaded.</p>
      </div>
    );
  }

  return (
    <ul className="cue-list card" aria-label="Subtitle cues">
      <li className="cue-list__header" aria-hidden="true">
        <span />
        <span className="mono-label">#</span>
        <span className="mono-label">Timings (HH:MM:SS,mmm)</span>
        <span className="mono-label">Text</span>
        <span />
      </li>
      {cues.map((cue, i) => (
        <CueRow key={cue.id} id={cue.id} index={i} />
      ))}
    </ul>
  );
}
