/**
 * useUrlSync — syncs the Colours store to/from the URL hash.
 *
 * Call once at app root (inside React, so hooks work).
 * - On mount: reads hash state and hydrates store if present.
 * - On store change: writes the hash (debounced 400 ms) via replaceState.
 *   400 ms avoids writing on every keystroke mid-edit while keeping the URL
 *   current after a deliberate change.
 *
 * Extracted here (not inlined into App.tsx) so the sync concern is a single
 * testable seam, and so App.tsx stays a pure layout shell.
 */

import { useEffect, useRef } from "react";
import { useColoursStore } from "../store";
import { readHashState, writeHashState } from "./share";

export function useUrlSync() {
  const hydrate = useColoursStore((s) => s.hydrate);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: hydrate from URL hash if present.
  // This runs once — StrictMode double-invoke is safe because hydrate is idempotent.
  useEffect(() => {
    const shared = readHashState();
    if (shared) hydrate(shared);
  }, [hydrate]);

  // Subscribe to store changes and debounce-write the hash.
  useEffect(() => {
    const unsub = useColoursStore.subscribe((state) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        writeHashState({
          palette: state.palette,
          twoPoint: state.twoPoint,
          threePoint: state.threePoint,
          space: state.space,
        });
        timerRef.current = null;
      }, 400);
    });

    return () => {
      unsub();
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);
}
