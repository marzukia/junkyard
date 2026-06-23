import type { Yard } from "../tools";
import { TOOLS, YARDS } from "../tools";

interface ToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  active: Yard | "all";
  onFilter: (f: Yard | "all") => void;
  searchRef: React.RefObject<HTMLInputElement>;
}

export function Toolbar({ query, onQuery, active, onFilter, searchRef }: ToolbarProps) {
  const chips: { id: Yard | "all"; label: string; count: number }[] = [
    { id: "all", label: "All", count: TOOLS.length },
    ...YARDS.map((y) => ({
      id: y.id,
      label: y.label,
      count: TOOLS.filter((t) => t.yard === y.id).length,
    })),
  ];

  return (
    <div className="tools-top">
      <label className="search">
        <span className="ic">&gt;</span>
        <input
          ref={searchRef}
          type="text"
          placeholder="search the yard...  try 'qr', 'pdf', 'image'"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <span className="kbd">/</span>
      </label>
      <div className="filters">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip${active === chip.id ? " on" : ""}`}
            onClick={() => onFilter(chip.id)}
          >
            {chip.label}
            <span className="n">{chip.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
