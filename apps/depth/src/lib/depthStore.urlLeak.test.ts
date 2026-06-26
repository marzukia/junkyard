/**
 * Object-URL leak guard for depthStore (gauntlet w3).
 *
 * Asserts that setInputFile revokes prior inputUrl and resultUrl. The
 * colourmap re-render path (setResultUrl) correctly revokes on its own
 * at the App.tsx call site and is not tested here.
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

import { useDepthStore } from "../store/depthStore";

function fakeFile(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  useDepthStore.setState({
    phase: "idle",
    inputFile: null,
    inputUrl: null,
    resultUrl: null,
    errorMsg: null,
    modelProgress: { loaded: 0, total: 1, status: "" },
    depthCache: null,
  });
});

describe("depthStore: setInputFile revokes prior inputUrl and resultUrl", () => {
  it("revokes the prior inputUrl when a new file is loaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useDepthStore.setState({ inputUrl: "blob:prior-input", resultUrl: null });
    useDepthStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:prior-input");
    revoke.mockRestore();
  });

  it("revokes the prior resultUrl when a new file is loaded (overwrite without Reset)", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useDepthStore.setState({ inputUrl: "blob:old-input", resultUrl: "blob:old-result" });
    useDepthStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:old-input");
    expect(revoke).toHaveBeenCalledWith("blob:old-result");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when there are no prior URLs", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useDepthStore.setState({ inputUrl: null, resultUrl: null });
    useDepthStore.getState().setInputFile(fakeFile(), "blob:first");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });

  it("clears resultUrl and depthCache after setInputFile", () => {
    useDepthStore.setState({
      inputUrl: "blob:old",
      resultUrl: "blob:result",
      depthCache: { normalised: new Float32Array([0.5]), width: 1, height: 1 },
    });
    useDepthStore.getState().setInputFile(fakeFile(), "blob:new");

    const s = useDepthStore.getState();
    expect(s.resultUrl).toBeNull();
    expect(s.depthCache).toBeNull();
  });
});
