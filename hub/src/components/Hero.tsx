import { TOOLS } from "../tools";

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
