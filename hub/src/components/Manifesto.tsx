export function Manifesto() {
  return (
    <section className="manifesto">
      <div className="wrap">
        <h2>
          Everything&apos;s free. <span className="accent">Always will be.</span>
        </h2>
        <p>
          I kept hitting tools that let you do 90% of a job, then put the download behind a
          subscription. So I rebuilt them, gave them away, and dumped them all here.{" "}
          <b>No accounts. No uploads. No nagging to upgrade.</b> Pick through the pile and grab what
          works.
        </p>
        <div className="links">
          <span>
            Built by <a href="https://mrzk.io">Andryo Marzuki</a>
          </span>
          <a href="https://github.com/marzukia">GitHub</a>
          <a href="https://charted.mrzk.io">charted (the library)</a>
          <a href="https://mrzk.io">mrzk.io</a>
        </div>
      </div>
    </section>
  );
}
