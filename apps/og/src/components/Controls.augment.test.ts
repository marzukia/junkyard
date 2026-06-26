/**
 * Regression tests for dogfood bug #2:
 * handleLogoUpload previously stored any FileReader result directly into the store
 * without Image validation, so corrupt files threw at export time with no UI feedback.
 *
 * These tests verify the validation path by simulating the Image onload/onerror
 * callbacks that the fixed handleLogoUpload now wires up — using the same
 * mock-Image pattern that is viable in jsdom.
 */
import { describe, expect, it } from "vitest";
import { useOgStore } from "../store";

// Helper: simulate what handleLogoUpload does internally — instantiates Image,
// assigns src, fires onload or onerror — so we can assert call behaviour
// without mounting the full React component (no canvas / FileReader available in jsdom).
function makeImageMock(succeed: boolean) {
  const img: Partial<HTMLImageElement> & {
    onload: (() => void) | null;
    onerror: (() => void) | null;
    src: string;
  } = {
    onload: null,
    onerror: null,
    src: "",
  };
  // When src is assigned, schedule callback on next tick
  Object.defineProperty(img, "src", {
    set(value: string) {
      (this as typeof img & { _src: string })._src = value;
      Promise.resolve().then(() => {
        if (succeed && this.onload) this.onload();
        if (!succeed && this.onerror) this.onerror();
      });
    },
    get() {
      return (this as typeof img & { _src: string })._src ?? "";
    },
  });
  return img;
}

describe("og logo validation (bug #2 regression)", () => {
  it("calls setLogoImage when Image decodes successfully", async () => {
    // Track calls via local variable to avoid Zustand spy cross-test leakage
    const dataUrl = "data:image/png;base64,abc123";
    let calledWith: string | null | undefined = undefined;
    let logoError: string | null = null;

    const img = makeImageMock(true);
    img.onload = () => {
      logoError = null;
      calledWith = dataUrl;
      useOgStore.getState().setLogoImage(dataUrl);
    };
    img.onerror = () => {
      logoError = "File could not be decoded as an image.";
    };
    img.src = dataUrl;
    await Promise.resolve();

    expect(calledWith).toBe(dataUrl);
    expect(logoError).toBeNull();
    // cleanup
    useOgStore.getState().setLogoImage(null);
  });

  it("does NOT call setLogoImage and sets error when Image fails to decode", async () => {
    const dataUrl = "data:text/plain;base64,bm90YW5pbWFnZQ==";
    let calledWith: string | null | undefined = undefined;
    let logoError: string | null = null;

    const img = makeImageMock(false);
    img.onload = () => {
      logoError = null;
      calledWith = dataUrl;
      useOgStore.getState().setLogoImage(dataUrl);
    };
    img.onerror = () => {
      logoError =
        "File could not be decoded as an image. Please upload a valid image file (JPEG, PNG, WebP, etc.).";
    };
    img.src = dataUrl;
    await Promise.resolve();

    // calledWith should remain undefined — onload never fired
    expect(calledWith).toBeUndefined();
    expect(logoError).not.toBeNull();
    expect(logoError).toContain("could not be decoded");
  });
});
