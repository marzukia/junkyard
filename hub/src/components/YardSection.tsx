import { useEffect, useRef } from "react";
import type { Tool } from "../tools";
import { ToolCard } from "./ToolCard";

interface YardSectionProps {
  id: string;
  label: string;
  tools: Tool[];
  /** Index of the first tool in this section within the full TOOLS array (for card numbers). */
  toolIndices: number[];
}

export function YardSection({ id, label, tools, toolIndices }: YardSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // Trigger the reveal class on mount. The component remounts (via key) whenever
  // the tool list changes, so an empty dep array is correct here.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    // Use rAF to match the prototype's requestAnimationFrame reveal timing
    const raf = requestAnimationFrame(() => {
      el.classList.add("reveal");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="section" id={id} ref={sectionRef}>
      <div className="shead">
        <h2>{label}</h2>
        <span className="c">{tools.length} tools</span>
      </div>
      <div className="grid">
        {tools.map((tool, i) => (
          <ToolCard key={tool.slug} tool={tool} index={toolIndices[i]} animationDelay={i * 0.03} />
        ))}
      </div>
    </section>
  );
}
