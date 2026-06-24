/**
 * Tests for URL revocation in faviconStore.
 * Guards the fix for the blob-URL leaks in setSource, setSourceMode, setZipUrl, and reset.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconStore } from "./faviconStore";

// Seed an object-URL-like string into the store so we can assert revoke fires.
function seedSourceUrl(url: string) {
  useFaviconStore.setState({ sourceUrl: url });
}
function seedZipUrl(url: string) {
  useFaviconStore.setState({ zipUrl: url });
}

describe("faviconStore URL revocation", () => {
  let revokeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    // Reset to clean state before each test
    useFaviconStore.setState({
      sourceFile: null,
      sourceUrl: null,
      sourceText: "",
      previews: [],
      zipUrl: null,
      status: "idle",
      errorMsg: null,
      progress: 0,
      sourceMode: "image",
    });
  });

  afterEach(() => {
    revokeSpy.mockRestore();
  });

  it("setSource revokes previous sourceUrl", () => {
    seedSourceUrl("blob:old-source");
    const file = new File(["x"], "x.png");
    useFaviconStore.getState().setSource(file, "blob:new-source");
    expect(revokeSpy).toHaveBeenCalledWith("blob:old-source");
  });

  it("setSource revokes previous zipUrl", () => {
    seedZipUrl("blob:old-zip");
    const file = new File(["x"], "x.png");
    useFaviconStore.getState().setSource(file, "blob:new-source");
    expect(revokeSpy).toHaveBeenCalledWith("blob:old-zip");
  });

  it("setSource does NOT revoke when sourceUrl is null", () => {
    // sourceUrl is null (default) -- revoke must not be called
    const file = new File(["x"], "x.png");
    useFaviconStore.getState().setSource(file, "blob:new-source");
    expect(revokeSpy).not.toHaveBeenCalled();
  });

  it("setSourceMode revokes previous sourceUrl", () => {
    seedSourceUrl("blob:source-for-mode");
    useFaviconStore.getState().setSourceMode("text");
    expect(revokeSpy).toHaveBeenCalledWith("blob:source-for-mode");
  });

  it("setSourceMode revokes previous zipUrl", () => {
    seedZipUrl("blob:zip-for-mode");
    useFaviconStore.getState().setSourceMode("text");
    expect(revokeSpy).toHaveBeenCalledWith("blob:zip-for-mode");
  });

  it("setZipUrl revokes previous zipUrl", () => {
    seedZipUrl("blob:old-zip");
    useFaviconStore.getState().setZipUrl("blob:new-zip");
    expect(revokeSpy).toHaveBeenCalledWith("blob:old-zip");
  });

  it("setZipUrl(null) revokes previous zipUrl", () => {
    seedZipUrl("blob:zip-to-clear");
    useFaviconStore.getState().setZipUrl(null);
    expect(revokeSpy).toHaveBeenCalledWith("blob:zip-to-clear");
  });

  it("reset revokes sourceUrl", () => {
    seedSourceUrl("blob:reset-source");
    useFaviconStore.getState().reset();
    expect(revokeSpy).toHaveBeenCalledWith("blob:reset-source");
  });

  it("reset revokes zipUrl", () => {
    seedZipUrl("blob:reset-zip");
    useFaviconStore.getState().reset();
    expect(revokeSpy).toHaveBeenCalledWith("blob:reset-zip");
  });

  it("reset does NOT revoke when urls are null", () => {
    useFaviconStore.getState().reset();
    expect(revokeSpy).not.toHaveBeenCalled();
  });
});
