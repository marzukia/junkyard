/**
 * Object-URL leak guard for bgStore (gauntlet w3).
 *
 * Asserts that setInputFile and setResult revoke prior blobs so a user who
 * drops a second image without pressing Reset does not leak multi-MB blobs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBgStore } from "../store/bgStore";

function fakeFile(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  useBgStore.setState({
    phase: "idle",
    inputFile: null,
    inputUrl: null,
    resultUrl: null,
    errorMsg: null,
    modelProgress: { loaded: 0, total: 1, status: "" },
    resultDimensions: { width: 0, height: 0 },
  });
});

describe("bgStore: setInputFile revokes prior inputUrl and resultUrl", () => {
  it("revokes the prior inputUrl when a new file is loaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useBgStore.setState({ inputUrl: "blob:prior-input", resultUrl: null });
    useBgStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:prior-input");
    revoke.mockRestore();
  });

  it("revokes the prior resultUrl when a new file is loaded (overwrite without Reset)", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useBgStore.setState({ inputUrl: "blob:old-input", resultUrl: "blob:old-result" });
    useBgStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:old-input");
    expect(revoke).toHaveBeenCalledWith("blob:old-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when there is no prior URL", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useBgStore.setState({ inputUrl: null, resultUrl: null });
    useBgStore.getState().setInputFile(fakeFile(), "blob:first");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});

describe("bgStore: setResult revokes prior resultUrl", () => {
  it("revokes the prior result blob when a new result arrives", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useBgStore.setState({ resultUrl: "blob:prior-result" });
    useBgStore.getState().setResult("blob:new-result", 800, 600);

    expect(revoke).toHaveBeenCalledWith("blob:prior-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when resultUrl is null", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useBgStore.setState({ resultUrl: null });
    useBgStore.getState().setResult("blob:first-result", 800, 600);

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
