import { useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Manifesto } from "./components/Manifesto";
import { Toolbar } from "./components/Toolbar";
import { YardSection } from "./components/YardSection";
import { TOOLS, YARDS } from "./tools";
import type { Yard } from "./tools";

export function App() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Yard | "all">("all");
  const searchRef = useRef<HTMLInputElement | null>(null);

  // '/' key focuses search (matching prototype behaviour)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const q = query.trim().toLowerCase();

  // Build the sections to render, keeping the prototype's logic exactly:
  // for each yard in YARDS order, filter by active yard, then by query,
  // skip if empty.
  const sections = YARDS.flatMap((yard) => {
    if (active !== "all" && active !== yard.id) return [];
    const items = TOOLS.flatMap((tool, i) => {
      if (tool.yard !== yard.id) return [];
      if (
        q &&
        !`${tool.name} ${tool.slug} ${tool.tagline} ${tool.incumbent}`.toLowerCase().includes(q)
      ) {
        return [];
      }
      return [{ tool, index: i }];
    });
    if (items.length === 0) return [];
    return [{ yard, items }];
  });

  const totalShown = sections.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <>
      <div className="strip" />
      <Header />
      <div className="wrap">
        <Hero />
        <Toolbar
          query={query}
          onQuery={setQuery}
          active={active}
          onFilter={setActive}
          searchRef={searchRef}
        />
        <main id="yard">
          {totalShown === 0 ? (
            <div className="empty">
              nothing matches <b>&quot;{q}&quot;</b> &mdash; try another search.
            </div>
          ) : (
            sections.map(({ yard, items }) => (
              <YardSection
                key={yard.id}
                id={yard.id}
                label={yard.label}
                tools={items.map((x) => x.tool)}
                toolIndices={items.map((x) => x.index)}
              />
            ))
          )}
        </main>
      </div>
      <Manifesto />
      <div className="wrap">
        <footer>
          <div className="fbar">
            <span>&#169; 2026 junkyard.sh &mdash; take freely</span>
            <span>built in a browser, runs in a browser</span>
          </div>
        </footer>
      </div>
    </>
  );
}
