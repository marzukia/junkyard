import { TOOLS } from "../tools";

export function Hero() {
  return (
    <section className="hero hero--solo">
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
    </section>
  );
}
