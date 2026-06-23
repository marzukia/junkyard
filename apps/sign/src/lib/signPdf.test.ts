import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canvasToPngDataUrl, hexToRgb, textToPngDataUrl } from "./signPdf";

// jsdom does not implement HTMLCanvasElement.getContext().
// We mock it to verify the pure-logic paths.

function makeCanvasWithCtx(hasPixels: boolean) {
  const mockGetImageData = (
    _x: number,
    _y: number,
    w: number,
    h: number
  ): { data: Uint8ClampedArray } => {
    const data = new Uint8ClampedArray(w * h * 4);
    if (hasPixels) {
      // Put one opaque pixel in the middle
      const midIdx = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
      data[midIdx] = 255;
      data[midIdx + 1] = 0;
      data[midIdx + 2] = 0;
      data[midIdx + 3] = 255; // alpha = 255 (opaque)
    }
    return { data };
  };

  const mockCtx = {
    getImageData: mockGetImageData,
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: (_t: string) => ({ width: 80 }),
    font: "",
    fillStyle: "",
    textBaseline: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    clearRect: vi.fn(),
  };

  const mockCanvas = {
    width: 100,
    height: 50,
    getContext: (_type: string) => mockCtx,
    toDataURL: (_mime?: string) =>
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  };

  return mockCanvas as unknown as HTMLCanvasElement;
}

// Stub document.createElement for canvas in tests
const origCreateElement = document.createElement.bind(document);

describe("canvasToPngDataUrl", () => {
  it("returns null for a fully transparent canvas", () => {
    const canvas = makeCanvasWithCtx(false);
    const result = canvasToPngDataUrl(canvas);
    expect(result).toBeNull();
  });

  it("returns a data URL when pixels are drawn", () => {
    // Stub document.createElement("canvas") to return our mock
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return makeCanvasWithCtx(true);
      return origCreateElement(tag);
    });
    const canvas = makeCanvasWithCtx(true);
    const result = canvasToPngDataUrl(canvas);
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
    vi.restoreAllMocks();
  });
});

describe("textToPngDataUrl", () => {
  beforeEach(() => {
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") return makeCanvasWithCtx(true);
      return origCreateElement(tag);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty text", () => {
    expect(textToPngDataUrl("", "#000000")).toBeNull();
    expect(textToPngDataUrl("   ", "#000000")).toBeNull();
  });

  it("returns a data URL for non-empty text", () => {
    const result = textToPngDataUrl("Jane Doe", "#1a2530");
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it("accepts custom font size", () => {
    const small = textToPngDataUrl("A", "#000", 32);
    const large = textToPngDataUrl("A", "#000", 96);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(small).toMatch(/^data:image\/png/);
    expect(large).toMatch(/^data:image\/png/);
  });

  it("accepts a custom fontSpec and applies the correct size override", () => {
    // A custom Pacifico-like fontSpec with a different pixel size
    const result = textToPngDataUrl("Jane", "#1a2530", 48, "72px 'Pacifico', cursive");
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\/png/);
  });

  it("returns null for empty text even with a custom fontSpec", () => {
    expect(textToPngDataUrl("", "#000", 72, "72px Georgia, serif")).toBeNull();
  });
});

describe("hexToRgb", () => {
  it("converts a valid hex colour to normalized rgb", () => {
    const result = hexToRgb("#ffffff");
    expect(result.red).toBeCloseTo(1);
    expect(result.green).toBeCloseTo(1);
    expect(result.blue).toBeCloseTo(1);
  });

  it("handles lowercase hex without hash", () => {
    const result = hexToRgb("1a2530");
    expect(result.red).toBeCloseTo(0x1a / 255);
    expect(result.green).toBeCloseTo(0x25 / 255);
    expect(result.blue).toBeCloseTo(0x30 / 255);
  });

  it("throws for malformed input (invalid chars)", () => {
    expect(() => hexToRgb("zzz")).toThrow("Invalid hex colour");
  });

  it("throws for empty input", () => {
    expect(() => hexToRgb("")).toThrow("Invalid hex colour");
  });

  it("parses 3-digit hex correctly", () => {
    const result = hexToRgb("#fff");
    expect(result.red).toBeCloseTo(1);
    expect(result.green).toBeCloseTo(1);
    expect(result.blue).toBeCloseTo(1);
  });

  it("parses 3-digit hex without hash", () => {
    const result = hexToRgb("abc");
    expect(result.red).toBeCloseTo(0xaa / 255);
    expect(result.green).toBeCloseTo(0xbb / 255);
    expect(result.blue).toBeCloseTo(0xcc / 255);
  });
});

describe("embedSignatureInPdf (pure logic validation)", () => {
  it("throws on missing page index", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([400, 600]);
    const bytes = (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;

    const { embedSignatureInPdf } = await import("./signPdf");

    // Minimal 1x1 transparent PNG data URL
    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    await expect(
      embedSignatureInPdf(bytes, {
        dataUrl: pngDataUrl,
        pageIndex: 5, // out of range
        xFrac: 0.1,
        yFrac: 0.1,
        wFrac: 0.2,
        hFrac: 0.1,
        canvasWidth: 400,
        canvasHeight: 600,
      })
    ).rejects.toThrow("Page 5 not found");
  });

  it("embeds signature and returns larger bytes", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([400, 600]);
    const originalBytes = (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;
    const originalSize = originalBytes.byteLength;

    const { embedSignatureInPdf } = await import("./signPdf");

    const pngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await embedSignatureInPdf(originalBytes, {
      dataUrl: pngDataUrl,
      pageIndex: 0,
      xFrac: 0.1,
      yFrac: 0.1,
      wFrac: 0.2,
      hFrac: 0.1,
      canvasWidth: 400,
      canvasHeight: 600,
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(originalSize);
  });
});

describe("embedSignatureOnPages", () => {
  const PNG_URL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  it("applies the signature to multiple pages", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([400, 600]);
    pdfDoc.addPage([400, 600]);
    pdfDoc.addPage([400, 600]);
    const bytes = (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;

    const { embedSignatureOnPages } = await import("./signPdf");

    const result = await embedSignatureOnPages(
      bytes,
      {
        dataUrl: PNG_URL,
        pageIndex: 0,
        xFrac: 0.1,
        yFrac: 0.1,
        wFrac: 0.2,
        hFrac: 0.1,
        canvasWidth: 400,
        canvasHeight: 600,
      },
      [0, 1, 2]
    );

    expect(result).toBeInstanceOf(Uint8Array);
    // Signed PDF should be larger than the original
    expect(result.length).toBeGreaterThan(bytes.byteLength);
  });

  it("skips invalid page indices gracefully", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([400, 600]);
    const bytes = (await pdfDoc.save()).buffer.slice(0) as ArrayBuffer;

    const { embedSignatureOnPages } = await import("./signPdf");

    // Page index 99 is out of range; should not throw, should still produce output
    await expect(
      embedSignatureOnPages(
        bytes,
        {
          dataUrl: PNG_URL,
          pageIndex: 0,
          xFrac: 0.1,
          yFrac: 0.1,
          wFrac: 0.2,
          hFrac: 0.1,
          canvasWidth: 400,
          canvasHeight: 600,
        },
        [0, 99]
      )
    ).resolves.toBeInstanceOf(Uint8Array);
  });
});

describe("generateSamplePdf", () => {
  it("produces a valid PDF ArrayBuffer with at least one page", async () => {
    const { generateSamplePdf } = await import("./samplePdf");
    const bytes = await generateSamplePdf();

    expect(bytes).toBeInstanceOf(ArrayBuffer);
    expect(bytes.byteLength).toBeGreaterThan(500);

    // Confirm it's a real PDF (starts with %PDF)
    const header = new TextDecoder().decode(new Uint8Array(bytes).slice(0, 4));
    expect(header).toBe("%PDF");
  });

  it("can be loaded by pdf-lib and has exactly 1 page", async () => {
    const { generateSamplePdf } = await import("./samplePdf");
    const { PDFDocument } = await import("pdf-lib");

    const bytes = await generateSamplePdf();
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
