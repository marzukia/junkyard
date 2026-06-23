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
          A pile of free tools I salvaged from behind paywalls and left out for anyone to grab. They
          all run <b>entirely in your browser</b>. No accounts, no uploads, no "upgrade to export".{" "}
          <b>Take what you need.</b>
        </p>
        <div className="cta">
          <a className="btn btn-primary" href="#yard">
            Browse the yard <span className="ar">&#x2193;</span>
          </a>
          <a className="btn btn-ghost" href="https://github.com/marzukia" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="statline">
          <span className="pill">
            <b>42</b> tools
          </span>
          <span className="pill coral">
            paywalls <b>0</b>
          </span>
          <span className="pill warn">
            cost <b>$0</b>
          </span>
          <span className="pill">
            uploads <b>none</b>
          </span>
        </div>
      </div>
      <div className="hero-right">
        <div className="window">
          <div className="winbar">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span className="url mono">junkyard.sh / the yard</span>
          </div>
          <div className="winbody">
            <div className="mini-grid">
              {/* Decorative showcase cards -- not interactive links */}
              <div className="mini">
                <div className="mtop">
                  <span className="mnum">#02</span>
                  <span className="mfree">FREE</span>
                </div>
                <div className="mname">QR Code</div>
                <div className="mdesc">
                  vs <s>qr-generator</s>
                </div>
              </div>
              <div className="mini">
                <div className="mtop">
                  <span className="mnum">#07</span>
                  <span className="mfree">FREE</span>
                </div>
                <div className="mname">Background Remover</div>
                <div className="mdesc">
                  vs <s>remove.bg</s>
                </div>
              </div>
              <div className="mini">
                <div className="mtop">
                  <span className="mnum">#14</span>
                  <span className="mfree">FREE</span>
                </div>
                <div className="mname">JSON Formatter</div>
                <div className="mdesc">
                  vs <s>jsonformatter</s>
                </div>
              </div>
              <div className="mini">
                <div className="mtop">
                  <span className="mnum">#33</span>
                  <span className="mfree">FREE</span>
                </div>
                <div className="mname">PDF Toolkit</div>
                <div className="mdesc">
                  vs <s>iLovePDF</s>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
