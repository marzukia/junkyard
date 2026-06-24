import { useMemo } from "react";
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
  // Memoize per-yard counts: they depend only on static TOOLS/YARDS, so this
  // computes once and never re-runs -- even when the query prop changes on each
  // keystroke, causing App and Toolbar to re-render.
  const chips = useMemo(
    () => [
      { id: "all" as Yard | "all", label: "All", count: TOOLS.length },
      ...YARDS.map((y) => ({
        id: y.id as Yard | "all",
        label: y.label,
        count: TOOLS.filter((t) => t.yard === y.id).length,
      })),
    ],
    [] // TOOLS and YARDS are module-level constants; no runtime dependencies.
  );

  return (
    <div className="tools-top">
      <label className="search">
        <span className="ic" aria-hidden="true">
          &gt;
        </span>
        <input
          ref={searchRef}
          type="text"
          aria-label="Search the yard"
          placeholder="search the yard…  try 'qr', 'pdf', 'image'"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <span className="kbd" aria-hidden="true">
          /
        </span>
      </label>
      <div className="filters">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip${active === chip.id ? " on" : ""}`}
            onClick={() => onFilter(chip.id)}
            aria-pressed={active === chip.id}
          >
            {chip.label}
            <span className="n">{chip.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
