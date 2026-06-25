import type { AppTag, Tool } from "../tools";

interface ToolCardProps {
  tool: Tool;
  index: number; // 0-based position in TOOLS array -- card number = index + 1
  animationDelay: number; // seconds
}

const TAG_LABELS: Record<AppTag, string> = {
  webgpu: "WebGPU",
  "on-device-ai": "On-device AI",
  "large-download": "Large download",
  beta: "Beta",
};

export function ToolCard({ tool, index, animationDelay }: ToolCardProps) {
  const cardNum = String(index + 1).padStart(2, "0");

  // Path-based routing - apps are served under /<slug>/ on the same site.
  const href = `/${tool.slug}/`;

  const hasTags = (tool.tags && tool.tags.length > 0) || tool.mcpExposed;

  return (
    <a className="card" href={href} style={{ animationDelay: `${animationDelay}s` }}>
      <div className="top">
        <span className="num">#{cardNum}</span>
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.tagline}</p>
      {hasTags && (
        <div className="card-tags">
          {tool.tags?.map((tag) => (
            <span key={tag} className={`tag-badge tag-badge--${tag}`}>
              {TAG_LABELS[tag]}
            </span>
          ))}
          {tool.mcpExposed && (
            <span
              className="tag-badge tag-badge--mcp"
              title="Exposed over the Model Context Protocol"
              aria-label="MCP, exposed over the Model Context Protocol"
            >
              MCP
            </span>
          )}
        </div>
      )}
      <div className="foot">
        {tool.incumbent ? (
          <span className="vs">free alternative to {tool.incumbent}</span>
        ) : (
          <span />
        )}
        <span className="go">
          open <span className="a">&#x2192;</span>
        </span>
      </div>
    </a>
  );
}
