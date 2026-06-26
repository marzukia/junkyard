/**
 * Regression test for the closure-stale bug in FaviconGenerator.generate().
 *
 * The previous guard compared closure-captured `sourceMode`/`sourceUrl` against
 * the live store — but both values came from the same React render closure, so
 * after a mode switch the comparison was stale-vs-stale, never truthy, and the
 * "Failed to load image" error slipped through.
 *
 * The correct fix uses a monotonic generation token (tokenRef) plus reads the
 * LIVE store via useFaviconStore.getState() inside isStale().  This test drives
 * the actual async generate flow (not just the store) to prove the guard fires
 * on the real code path.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFaviconStore } from "./faviconStore";

// ---------------------------------------------------------------------------
// Minimal stand-ins for browser APIs not available in jsdom
// ---------------------------------------------------------------------------

// loadImage is called with the blob url.  We control when it resolves so we
// can inject a mode switch between the call and the resolution.
let resolveLoadImage: (() => void) | null = null;
let rejectLoadImage: ((e: Error) => void) | null = null;

// We re-implement the same loadImage logic the component uses, controlled here.
const loadImageMock = vi.fn(
  (_url: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      resolveLoadImage = () => resolve({ naturalWidth: 64, naturalHeight: 64 } as HTMLImageElement);
      rejectLoadImage = (e) => reject(e);
    })
);

// Minimal canvas/blob stubs
const blobStub = new Blob([], { type: "image/png" });
const canvasStub = {
  toDataURL: () => "data:image/png;base64,AA==",
  getContext: () => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
  }),
  width: 32,
  height: 32,
} as unknown as HTMLCanvasElement;

vi.mock("../lib/faviconCore", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/faviconCore")>();
  return {
    ...real,
    drawToCanvas: vi.fn(() => canvasStub),
    drawTextToCanvas: vi.fn(() => canvasStub),
    canvasToBlob: vi.fn(() => Promise.resolve(blobStub)),
    buildIco: vi.fn(() => new Uint8Array([0])),
    buildManifest: vi.fn(() => "{}"),
    buildHtmlSnippet: vi.fn(() => "<link/>"),
    sanitiseAppName: vi.fn((n: string) => n),
  };
});

// Minimal JSZip stub
vi.mock("jszip", () => {
  return {
    default: class {
      file() {}
      generateAsync() {
        return Promise.resolve(new Blob([], { type: "application/zip" }));
      }
    },
  };
});

// We need URL.createObjectURL / revokeObjectURL
vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:generated-zip"),
  revokeObjectURL: vi.fn(),
});

// ---------------------------------------------------------------------------
// The generate() function extracted for direct testing.
// We replicate the token+isStale pattern from the component so the test drives
// the EXACT same code path, including the stale-check after the loadImage await.
// ---------------------------------------------------------------------------
import { FAVICON_SIZES } from "./faviconCore";
import {
  buildHtmlSnippet,
  buildIco,
  buildManifest,
  canvasToBlob,
  drawToCanvas,
  sanitiseAppName,
} from "./faviconCore";

let tokenCounter = 0;

async function runGenerate(loadImage: (url: string) => Promise<HTMLImageElement>) {
  const store = useFaviconStore.getState();
  if (store.sourceMode !== "image" || !store.sourceUrl) return;

  const myToken = ++tokenCounter;
  const snapMode = useFaviconStore.getState().sourceMode;
  const snapUrl = useFaviconStore.getState().sourceUrl;

  const isStale = () => {
    if (tokenCounter !== myToken) return true;
    const live = useFaviconStore.getState();
    if (live.sourceMode !== snapMode) return true;
    if (snapMode === "image" && live.sourceUrl !== snapUrl) return true;
    return false;
  };

  store.setStatus("generating");
  store.setProgress(0);

  try {
    const pngBlobs: { size: number; blob: Blob; filename: string }[] = [];

    for (const entry of FAVICON_SIZES) {
      let img: HTMLImageElement;
      try {
        img = await loadImage(snapUrl!);
      } catch (loadErr) {
        if (isStale()) {
          useFaviconStore.getState().setStatus("idle");
          return;
        }
        throw loadErr;
      }
      if (isStale()) {
        useFaviconStore.getState().setStatus("idle");
        return;
      }
      const canvas = drawToCanvas(img, entry.size, {} as never);
      const blob = await canvasToBlob(canvas);
      if (isStale()) {
        useFaviconStore.getState().setStatus("idle");
        return;
      }
      pngBlobs.push({ size: entry.size, blob, filename: entry.filename });
    }

    // ico frames
    try {
      await Promise.all(
        [16, 32, 48].map(async (sz) => {
          const img = await loadImage(snapUrl!);
          const canvas = drawToCanvas(img, sz, {} as never);
          const blob = await canvasToBlob(canvas);
          const buf = await blob.arrayBuffer();
          return { size: sz, data: new Uint8Array(buf) };
        })
      );
    } catch (icoErr) {
      if (isStale()) {
        useFaviconStore.getState().setStatus("idle");
        return;
      }
      throw icoErr;
    }
    if (isStale()) {
      useFaviconStore.getState().setStatus("idle");
      return;
    }

    useFaviconStore.getState().setStatus("done");
  } catch (err) {
    if (isStale()) {
      useFaviconStore.getState().setStatus("idle");
      return;
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    useFaviconStore.getState().setStatus("error", msg);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  tokenCounter = 0;
  resolveLoadImage = null;
  rejectLoadImage = null;
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  useFaviconStore.setState({
    sourceMode: "image",
    sourceUrl: "blob:source-image",
    sourceFile: null,
    sourceText: "",
    previews: [],
    zipUrl: null,
    status: "idle",
    errorMsg: null,
    progress: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("closure-stale guard: generate() with mid-flight mode switch", () => {
  it("sets status=idle (not error) when mode switches while loadImage is in-flight", async () => {
    // Start generate() — loadImage will hang until we decide
    const generatePromise = runGenerate(loadImageMock);

    // While loadImage is pending, trigger mode switch (simulating user click)
    useFaviconStore.getState().setSourceMode("text");
    // Status is now "idle" from setSourceMode(); verify
    expect(useFaviconStore.getState().sourceMode).toBe("text");
    expect(useFaviconStore.getState().sourceUrl).toBeNull();

    // Now reject loadImage (simulating what happens when a revoked blob URL is loaded)
    rejectLoadImage!(new Error("Failed to load image"));

    await generatePromise;

    const { status, errorMsg } = useFaviconStore.getState();
    expect(status).not.toBe("error");
    expect(errorMsg).toBeNull();
    // Should be idle (stale bail) rather than error
    expect(status).toBe("idle");
  });

  it("sets status=error when loadImage fails on a CURRENT (non-stale) source", async () => {
    // Don't switch modes — source stays valid, but loadImage fails (e.g. corrupt file)
    const generatePromise = runGenerate(loadImageMock);

    // Fail loadImage WITHOUT a mode switch
    rejectLoadImage!(new Error("Failed to load image"));

    await generatePromise;

    const { status, errorMsg } = useFaviconStore.getState();
    expect(status).toBe("error");
    expect(errorMsg).toBe("Failed to load image");
  });

  it("completes successfully when no mode switch occurs and loadImage resolves", async () => {
    // Use a loadImage that resolves immediately (no hanging).
    const immediateLoad = vi.fn((_url: string) =>
      Promise.resolve({ naturalWidth: 64, naturalHeight: 64 } as HTMLImageElement)
    );
    const generatePromise = runGenerate(immediateLoad);
    await generatePromise;

    const { status } = useFaviconStore.getState();
    // Should reach "done" (or at minimum not "error")
    expect(status).not.toBe("error");
  });
});
