import { useMantineColorScheme } from "@mantine/core";

function MonitorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        fill="none"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <div className="space-toggle-wrapper">
      <div className="space-toggle" aria-label="Color scheme">
        <button
          type="button"
          className={`space-btn${colorScheme === "auto" ? " space-btn--active" : ""}`}
          onClick={() => setColorScheme("auto")}
          aria-pressed={colorScheme === "auto"}
          title="Follow system"
        >
          <MonitorIcon />
          <span>System</span>
        </button>
        <button
          type="button"
          className={`space-btn${colorScheme === "light" ? " space-btn--active" : ""}`}
          onClick={() => setColorScheme("light")}
          aria-pressed={colorScheme === "light"}
          title="Light mode"
        >
          <SunIcon />
          <span>Light</span>
        </button>
        <button
          type="button"
          className={`space-btn${colorScheme === "dark" ? " space-btn--active" : ""}`}
          onClick={() => setColorScheme("dark")}
          aria-pressed={colorScheme === "dark"}
          title="Dark mode"
        >
          <MoonIcon />
          <span>Dark</span>
        </button>
      </div>
    </div>
  );
}
