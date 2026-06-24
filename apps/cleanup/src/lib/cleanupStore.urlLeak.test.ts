/**
 * Object-URL leak guard for cleanupStore (gauntlet w5).
 *
 * Asserts that setInputFile and setResult revoke prior blobs so a user who
 * drops a second image without pressing Reset does not leak multi-MB blobs.
 * Mirrors apps/bg/src/lib/bgStore.urlLeak.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCleanupStore } from "../store/cleanupStore";

function fakeFile(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
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

describe("cleanupStore: setInputFile revokes prior inputUrl and resultUrl", () => {
  it("revokes the prior inputUrl when a new file is loaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCleanupStore.setState({ inputUrl: "blob:prior-input", resultUrl: null });
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:prior-input");
    revoke.mockRestore();
  });

  it("revokes the prior resultUrl when a new file is loaded (overwrite without Reset)", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCleanupStore.setState({ inputUrl: "blob:old-input", resultUrl: "blob:old-result" });
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:old-input");
    expect(revoke).toHaveBeenCalledWith("blob:old-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when there is no prior URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCleanupStore.setState({ inputUrl: null, resultUrl: null });
    useCleanupStore.getState().setInputFile(fakeFile(), "blob:first");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});

describe("cleanupStore: setResult revokes prior resultUrl", () => {
  it("revokes the prior result blob when a new result arrives", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCleanupStore.setState({ resultUrl: "blob:prior-result" });
    useCleanupStore.getState().setResult("blob:new-result");

    expect(revoke).toHaveBeenCalledWith("blob:prior-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when resultUrl is null", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCleanupStore.setState({ resultUrl: null });
    useCleanupStore.getState().setResult("blob:first-result");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
