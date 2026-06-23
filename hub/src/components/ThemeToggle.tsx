import { useEffect, useState } from "react";

type Scheme = "system" | "light" | "dark";

const STORAGE_KEY = "jy-scheme";

function applyScheme(mode: Scheme): void {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-scheme", dark ? "dark" : "light");
}

function readStored(): Scheme {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch (_e) {
    // localStorage unavailable
  }
  return "system";
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Scheme>(readStored);

  // React to OS theme change when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") applyScheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  function pick(next: Scheme) {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (_e) {
      // ignore
    }
    applyScheme(next);
  }

  return (
    <div className="toggle">
      <button
        type="button"
        className={mode === "system" ? "on" : ""}
        onClick={() => pick("system")}
      >
        <span className="lg">System</span>
        <span className="sm">Sys</span>
      </button>
      <button type="button" className={mode === "light" ? "on" : ""} onClick={() => pick("light")}>
        <span className="lg">Light</span>
        <span className="sm">Lt</span>
      </button>
      <button type="button" className={mode === "dark" ? "on" : ""} onClick={() => pick("dark")}>
        <span className="lg">Dark</span>
        <span className="sm">Dk</span>
      </button>
    </div>
  );
}
