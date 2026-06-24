/**
 * Regression test for dogfood wave-2 bug #3:
 * An undecodable image (valid MIME, corrupt data) must not leave the cleanup app
 * stuck in phase="loaded" with no error and no way to recover.
 *
 * The fix adds img.onerror → setError() + reset() to the dimension-loading
 * useEffect.  We verify the store transitions here: setError must flip phase to
 * "error" and reset must return to "idle".
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
  it("setError transitions phase to 'error' with a message", () => {
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore.getState().setError("Could not load the image. The file may be corrupt or unsupported.");
    const s = useCleanupStore.getState();
    expect(s.phase).toBe("error");
    expect(s.errorMsg).toContain("Could not load");
  });

  it("reset after onerror returns to idle with no inputUrl", () => {
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    useCleanupStore.getState().setError("bad image");
    useCleanupStore.getState().reset();
    const s = useCleanupStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.inputUrl).toBeNull();
    expect(s.errorMsg).toBeNull();
  });

  it("setPhase('loaded') is NOT reached when onerror fires before onload", () => {
    // Simulate: file set, but then onerror fires instead of onload.
    // The store should never reach phase=loaded if we call setError+reset instead.
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:fake");
    // onerror fires — call the same sequence the fixed useEffect runs:
    useCleanupStore.getState().setError("corrupt");
    useCleanupStore.getState().reset();
    // phase must not be "loaded"
    expect(useCleanupStore.getState().phase).not.toBe("loaded");
  });
});
