/**
 * Object-URL leak guard for upscaleStore (gauntlet w3).
 *
 * Asserts that setInputFile and setResult revoke prior blobs. Covers the
 * handleProceedClamped double-call pattern where setInputFile fires twice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub localStorage before importing the store (uses zustand persist)
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

import { useUpscaleStore } from "../store/upscaleStore";

function fakeFile(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  useUpscaleStore.setState({
    phase: "idle",
    scale: 2,
    outputFormat: "png",
    inputFile: null,
    inputUrl: null,
    inputWidth: null,
    inputHeight: null,
    resultUrl: null,
    resultWidth: null,
    resultHeight: null,
    resultSize: null,
    errorMsg: null,
    modelProgress: { loaded: 0, total: 1, status: "" },
  });
});

describe("upscaleStore: setInputFile revokes prior inputUrl and resultUrl", () => {
  it("revokes the prior inputUrl when a new file is loaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useUpscaleStore.setState({ inputUrl: "blob:prior-input", resultUrl: null });
    useUpscaleStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:prior-input");
    revoke.mockRestore();
  });

  it("revokes both prior blobs on second call (handleProceedClamped double-call)", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    // First call -- sets inputUrl to "blob:first"
    useUpscaleStore.setState({ inputUrl: null, resultUrl: null });
    useUpscaleStore.getState().setInputFile(fakeFile(), "blob:first");
    expect(revoke).not.toHaveBeenCalled();

    // Second call (as handleProceedClamped does) -- must revoke "blob:first"
    useUpscaleStore.getState().setInputFile(fakeFile(), "blob:second");
    expect(revoke).toHaveBeenCalledWith("blob:first");

    revoke.mockRestore();
  });

  it("revokes the prior resultUrl when a new file is loaded (overwrite without Reset)", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useUpscaleStore.setState({ inputUrl: "blob:old-input", resultUrl: "blob:old-result" });
    useUpscaleStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:old-input");
    expect(revoke).toHaveBeenCalledWith("blob:old-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when there are no prior URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useUpscaleStore.setState({ inputUrl: null, resultUrl: null });
    useUpscaleStore.getState().setInputFile(fakeFile(), "blob:first");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});

describe("upscaleStore: setResult revokes prior resultUrl", () => {
  it("revokes the prior result blob when a new result arrives", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useUpscaleStore.setState({ resultUrl: "blob:prior-result" });
    useUpscaleStore.getState().setResult("blob:new-result", 1600, 1200, 12345);

    expect(revoke).toHaveBeenCalledWith("blob:prior-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when resultUrl is null", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useUpscaleStore.setState({ resultUrl: null });
    useUpscaleStore.getState().setResult("blob:first-result", 1600, 1200, 12345);

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
