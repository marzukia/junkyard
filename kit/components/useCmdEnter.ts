/**
 * Shared hook: Cmd/Ctrl+Enter fires the callback.
 * Every junkyard app uses this instead of duplicating the keydown listener.
 */
import { useEffect, useRef } from "react";

export function useCmdEnter(fn: () => void): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        fnRef.current();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
