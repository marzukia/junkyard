import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header>
      <div className="wrap hbar">
        <a className="logo" href="/" aria-label="junkyard.sh home">
          <span className="mk">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="wm">
            junkyard<span className="sh">.sh</span>
          </span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
