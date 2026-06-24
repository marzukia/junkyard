/**
 * Object-URL leak guard for faviconStore.setSourceText (gauntlet w6).
 *
 * Asserts that setSourceText revokes a prior zipUrl so repeated generate→edit-text→generate
 * cycles in text/emoji mode do not leak multi-MB zip blobs.
 * Mirrors apps/cleanup/src/lib/cleanupStore.urlLeak.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconStore } from "./faviconStore";

beforeEach(() => {
  useFaviconStore.setState({
    sourceFile: null,
    sourceUrl: null,
    sourceText: "",
    previews: [],
    zipUrl: null,
    status: "idle",
    errorMsg: null,
    progress: 0,
    sourceMode: "text",
  });
});

describe("faviconStore: setSourceText revokes prior zipUrl", () => {
  it("revokes the prior zipUrl when source text is changed", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useFaviconStore.setState({ zipUrl: "blob:a" });
    useFaviconStore.getState().setSourceText("x");

    expect(revoke).toHaveBeenCalledWith("blob:a");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when zipUrl is null", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useFaviconStore.setState({ zipUrl: null });
    useFaviconStore.getState().setSourceText("hello");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });
});
