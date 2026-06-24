/**
 * Object-URL leak guard for captionStore (gauntlet w3).
 *
 * Asserts that setInputFile revokes the prior inputUrl so a user who drops a
 * second image without pressing Reset does not leak multi-MB blobs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCaptionStore } from "../store/captionStore";

function fakeFile(name = "photo.jpg") {
  return new File(["x"], name, { type: "image/jpeg" });
}

beforeEach(() => {
  useCaptionStore.setState({
    phase: "idle",
    inputMode: "file",
    inputFile: null,
    inputUrl: null,
    urlInput: "",
    caption: null,
    editedCaption: null,
    candidates: [],
    selectedIndex: 0,
    errorMsg: null,
    modelProgress: { loaded: 0, total: 1, status: "" },
    copied: false,
    copiedAlt: false,
    numCaptions: 1,
  });
});

describe("captionStore: setInputFile revokes prior inputUrl", () => {
  it("revokes the prior inputUrl when a new file is loaded", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCaptionStore.setState({ inputUrl: "blob:prior-input" });
    useCaptionStore.getState().setInputFile(fakeFile(), "blob:new-input");

    expect(revoke).toHaveBeenCalledWith("blob:prior-input");
    revoke.mockRestore();
  });

  it("does not call revokeObjectURL when inputUrl is null", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCaptionStore.setState({ inputUrl: null });
    useCaptionStore.getState().setInputFile(fakeFile(), "blob:first");

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });

  it("clears caption state when a new file is loaded", () => {
    useCaptionStore.setState({
      inputUrl: "blob:old",
      caption: "old caption",
      editedCaption: "edited",
      candidates: ["alt1"],
      copied: true,
    });
    useCaptionStore.getState().setInputFile(fakeFile(), "blob:new");

    const s = useCaptionStore.getState();
    expect(s.caption).toBeNull();
    expect(s.editedCaption).toBeNull();
    expect(s.candidates).toEqual([]);
    expect(s.copied).toBe(false);
  });
});
