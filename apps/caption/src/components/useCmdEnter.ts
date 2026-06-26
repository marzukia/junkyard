/**
 * Shared hook: Cmd/Ctrl+Enter fires the callback.
 * Every junkyard app uses this instead of duplicating the keydown listener.
 */
import { useCallback, useEffect } from "react";

export function useCmdEnter(fn: () => void): void {
  const callback = useCallback(fn, [fn]);
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        callback();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [callback]);
}
