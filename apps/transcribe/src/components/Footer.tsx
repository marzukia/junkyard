interface FooterProps {
  /** Optional short blurb about the tool's internals, shown before the author credit. */
  blurb?: string;
}

export function Footer({ blurb }: FooterProps) {
  return (
    <footer className="site-footer">
      {blurb != null && (
        <>
          <span>{blurb}</span>
          <span className="site-footer-sep">·</span>
        </>
      )}
      <span>
        Made by{" "}
        <a href="https://mrzk.io" target="_blank" rel="noreferrer" className="site-footer-link">
          Andryo Marzuki
        </a>
      </span>
      <span className="site-footer-sep">·</span>
      <a href="https://mrzk.io/apps/" target="_blank" rel="noreferrer" className="site-footer-link">
        more tools
      </a>
    </footer>
  );
}
