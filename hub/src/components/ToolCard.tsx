import type { Tool } from "../tools";

interface ToolCardProps {
  tool: Tool;
  index: number; // 0-based position in TOOLS array -- card number = index + 1
  animationDelay: number; // seconds
}

export function ToolCard({ tool, index, animationDelay }: ToolCardProps) {
  const cardNum = String(index + 1).padStart(2, "0");
  // "vs <incumbent>" when an incumbent exists, otherwise "free forever"
  const vsContent = tool.incumbent ? (
    <>
      vs <s>{tool.incumbent}</s>
    </>
  ) : (
    "free forever"
  );

  // PHASE 2: switch to path-based routing junkyard.sh/<slug> when apps are
  // consolidated onto one site.
  const href = `https://${tool.slug}.mrzk.io`;

  return (
    <a
      className="card"
      href={href}
      style={{ animationDelay: `${animationDelay}s` }}
      target="_blank"
      rel="noreferrer"
    >
      <div className="top">
        <span className="num">#{cardNum}</span>
        <span className="free">FREE</span>
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.tagline}</p>
      <div className="foot">
        <span className="vs">{vsContent}</span>
        <span className="go">
          open <span className="a">&#x2192;</span>
        </span>
      </div>
    </a>
  );
}
