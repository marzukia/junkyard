export function Manifesto() {
  return (
    <section className="manifesto">
      <div className="wrap">
        <h2>
          Free, open, and out to make the web <span className="accent">suck less.</span>
        </h2>
        <p>
          Paywalls turned the web into a toll road - do 90% of the work, then pay to leave with it.
          I am not into that. So I rebuild these tools, open-source every one, and dump them here
          for anyone to use or improve. <b>No accounts. No uploads. No nagging to upgrade.</b> A
          better internet gives more than it takes - if you are in, the repo is open: fork it, file
          an issue, send a fix.
        </p>
        <div className="links">
          <span>
            Built by <a href="https://mrzk.io">Andryo Marzuki</a>
          </span>
          <a href="https://github.com/marzukia/junkyard">Source on GitHub</a>
          <a href="https://mrzk.io">mrzk.io</a>
        </div>
        <p className="disclaimer">
          junkyard is an independent open-source project. Not affiliated with or endorsed by any
          product it compares to. Product names and trademarks are the property of their respective
          owners.
        </p>
      </div>
    </section>
  );
}
