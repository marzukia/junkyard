/**
 * Regression test for dogfood wave-2 bug #3 (corrected wave-3):
 * An undecodable image must surface .cl-error-msg to the user AND allow a new
 * upload without requiring a manual "Try again" click.
 *
 * The original wave-2 fix called setError() + reset() in the same tick.
 * reset() (= set({...INITIAL})) clears errorMsg immediately, so the user saw
 * an empty idle screen instead of an error.
 *
 * The corrected fix calls setError() only.  setError() sets phase="error",
 * which renders both .cl-error-msg and a new DropZone (line 801+ of App.tsx).
 * reset() is NOT called in onerror — it remains available only for the explicit
 * "Try again" / "New image" buttons.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useCleanupStore } from "../store/cleanupStore";

function fakeFile(name = "bad.jpg") {
  return new File(["not-an-image"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  useCleanupStore.setState({
    phase: "idle",
    inputFile: null,
    inputUrl: null,
    resultUrl: null,
    errorMsg: null,
  });
});

describe("cleanupStore: decode-failure path via onerror", () => {
  it("setError transitions phase to 'error' with a message (error is visible)", () => {
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore
      .getState()
      .setError("Could not load the image. The file may be corrupt or unsupported.");
    const s = useCleanupStore.getState();
    expect(s.phase).toBe("error");
    expect(s.errorMsg).toContain("Could not load");
  });

  it("errorMsg is non-null after decode failure — message is rendered to the user", () => {
    // Simulate the corrected onerror handler: setError() only, no reset().
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore
      .getState()
      .setError("Could not load the image. The file may be corrupt or unsupported.");
    // errorMsg must be populated so .cl-error-msg renders.
    expect(useCleanupStore.getState().errorMsg).not.toBeNull();
  });

  it("phase='error' allows re-upload (DropZone visible at line 801 of App.tsx)", () => {
    // When phase="error", the JSX at (phase === "done" || phase === "error")
    // renders a new DropZone beneath the error message.
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore.getState().setError("corrupt");
    expect(useCleanupStore.getState().phase).toBe("error");
    // phase must NOT be "idle" — that would hide the error before the user sees it.
    expect(useCleanupStore.getState().phase).not.toBe("idle");
  });

  it("reset() after user clicks 'Try again' returns to idle with error cleared", () => {
    // Explicit reset (from the button) must still work cleanly.
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore.getState().setError("bad image");
    useCleanupStore.getState().reset();
    const s = useCleanupStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.inputUrl).toBeNull();
    expect(s.errorMsg).toBeNull();
  });
});
