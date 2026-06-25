import { TOOLS } from "../tools";

const MCP_TOOL_NAMES = [
  "junkyard_json_format",
  "junkyard_qr_generate",
  "junkyard_hash_sha256",
  "junkyard_base64_encode",
  "junkyard_uuid_generate",
];

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-left">
        <h1>
          <span className="lock">
            junkyard<span className="sh">.sh</span>
          </span>
        </h1>
        <p className="lead">
          Paywalls crept into everything - tools that do 90% of a job, then hold the result hostage
          until you hand over a card. I got fed up and started rebuilding them, open-sourcing every
          one, and giving them away. They run <b>entirely in your browser</b> - no accounts, no
          uploads, no "upgrade to export". It&apos;s a junkyard: take what you need, and if you can
          make it better, the source is right there.
        </p>
        <div className="cta">
          <a className="btn btn-primary" href="#yard">
            Browse the yard <span className="ar">&#x2193;</span>
          </a>
          <a
            className="btn btn-ghost"
            href="https://github.com/marzukia/junkyard"
            target="_blank"
            rel="noreferrer"
          >
            View source
          </a>
        </div>
        <div className="statline">
          <span className="pill">
            <b>{TOOLS.length}</b> tools
          </span>
          <span className="pill warn">
            <b>$0</b> forever
          </span>
          <span className="pill coral">
            no <b>paywalls</b>
          </span>
          <span className="pill">
            <b>open source</b>
          </span>
        </div>
      </div>

      <div className="hero-right">
        <div className="term">
          <div className="term-bar">
            <span className="term-dot term-dot--teal" />
            <span className="term-dot term-dot--amber" />
            <span className="term-dot term-dot--coral" />
            <span className="term-label">junkyard / mcp</span>
          </div>
          <pre className="term-body">
            <span className="t-prompt">$</span>
            {" "}
            <span className="t-cmd">git clone</span>
            {" "}
            <span className="t-path">github.com/marzukia/junkyard</span>
            {"\n"}
            <span className="t-prompt">$</span>
            {" "}
            <span className="t-cmd">cd junkyard</span>
            {" && "}
            <span className="t-cmd">bun install</span>
            {"\n"}
            <span className="t-prompt">$</span>
            {" "}
            <span className="t-cmd">bun run</span>
            {" "}
            <span className="t-path">packages/mcp-server/src/index.ts</span>
            {"\n"}
            <span className="t-ok">✓</span>
            {" "}
            <span className="t-num">17</span>
            {" tools · "}
            <span className="t-num">25</span>
            {" ops exposed over "}
            <span className="t-ok">MCP</span>
            {"\n"}
            {MCP_TOOL_NAMES.map((name, i) => (
              <span key={name} className={i % 2 === 0 ? "t-tool-teal" : "t-tool-coral"}>
                {name}
                {i < MCP_TOOL_NAMES.length - 1 ? " · " : " …"}
              </span>
            ))}
          </pre>
        </div>
        <p className="term-caption">
          Every tool also runs headless over MCP. Wire it into Claude, Hermes, or your favourite agent harness.
        </p>
        <span className="bun-badge">Built with Bun ⚡</span>
      </div>
    </section>
  );
}
