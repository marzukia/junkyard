import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header>
      <div className="strip" />
      <div className="wrap hbar">
        <a className="logo" href="/" aria-label="junkyard.sh home">
          <svg
            className="mk"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <g transform="rotate(-13 16 16)">
              <clipPath id="jyTagHeader">
                <path d="M14.2 4.6 L25 7.2 a1.6 1.6 0 0 1 1.2 1.2 L28.8 25 a1.8 1.8 0 0 1-1.5 2 L13 29.2 a1.8 1.8 0 0 1-2-1.5 L8.4 12 a1.8 1.8 0 0 1 .5-1.6 L13 6 Z" />
              </clipPath>
              <g clipPath="url(#jyTagHeader)">
                <rect x="0" y="0" width="32" height="12.5" fill="#2f9d8d" />
                <rect x="0" y="12.5" width="32" height="9" fill="#e8b04b" />
                <rect x="0" y="21.5" width="32" height="11" fill="#d9594c" />
              </g>
              <circle cx="13.2" cy="8.7" r="1.7" fill="#fff" />
              <path
                d="M16 14.5 l4 3.4 l-4 3.4"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
          <span className="wm">
            <span className="wm-j">junkyard</span>
            <span className="sh">.sh</span>
          </span>
        </a>
        <div className="hcontrols">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
