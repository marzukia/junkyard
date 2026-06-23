import { describe, expect, it } from "vitest";
import {
  byteLength,
  formatBytes,
  optimizeSvg,
  parseFriendlyError,
  toBase64DataUri,
  toDataUri,
  toJsxComponent,
} from "./svgOptimize";
import type { OptimizeOptions } from "./svgOptimize";

const DEFAULT_OPTS: OptimizeOptions = {
  precision: 2,
  stripMetadata: true,
  collapseGroups: true,
  removeViewBox: false,
  removeComments: true,
  convertShapes: true,
  cleanupIds: true,
};

const SAMPLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator 24.0, SVG Export Plug-In -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  version="1.1" x="0px" y="0px" viewBox="0 0 100 100" xml:space="preserve">
  <title>My Icon</title>
  <desc>A sample icon for testing</desc>
  <g id="Layer_1" data-name="Layer 1">
    <g>
      <g>
        <circle cx="50.0000" cy="50.0000" r="40.0000" fill="#ff0000"/>
      </g>
    </g>
  </g>
</svg>`;

describe("optimizeSvg", () => {
  it("produces smaller output than input for a typical SVG", () => {
    const result = optimizeSvg(SAMPLE_SVG, DEFAULT_OPTS);
    expect(result.optimizedBytes).toBeLessThan(result.originalBytes);
    expect(result.saving).toBeGreaterThan(0);
  });

  it("strips metadata when stripMetadata=true", () => {
    const result = optimizeSvg(SAMPLE_SVG, {
      ...DEFAULT_OPTS,
      stripMetadata: true,
      collapseGroups: false,
      removeComments: true,
    });
    expect(result.optimized).not.toContain("Adobe Illustrator");
    expect(result.optimized).not.toContain("<title>");
    expect(result.optimized).not.toContain("<desc>");
  });

  it("removes comments when removeComments=true", () => {
    const result = optimizeSvg(SAMPLE_SVG, {
      ...DEFAULT_OPTS,
      stripMetadata: false,
      collapseGroups: false,
      removeComments: true,
    });
    expect(result.optimized).not.toContain("<!--");
  });

  it("collapses nested groups when collapseGroups=true", () => {
    const nestedGroupSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <g><g><circle cx="50" cy="50" r="40"/></g></g>
    </svg>`;
    const result = optimizeSvg(nestedGroupSvg, {
      ...DEFAULT_OPTS,
      stripMetadata: false,
      collapseGroups: true,
      removeComments: false,
    });
    // Collapsed groups should produce fewer <g> tags
    const gCount = (result.optimized.match(/<g/g) ?? []).length;
    expect(gCount).toBeLessThan(2);
  });

  it("rounds coordinates to the given precision", () => {
    const precisionSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <circle cx="50.123456789" cy="50.987654321" r="40.111111111"/>
    </svg>`;
    const result = optimizeSvg(precisionSvg, {
      ...DEFAULT_OPTS,
      precision: 2,
      stripMetadata: false,
      collapseGroups: false,
      removeComments: false,
    });
    // Should not contain more than 2 decimal places
    expect(result.optimized).not.toMatch(/\d\.\d{3,}/);
  });

  it("returns saving as a number for minimal SVG", () => {
    const result = optimizeSvg("<svg xmlns='http://www.w3.org/2000/svg'/>", {
      ...DEFAULT_OPTS,
      stripMetadata: false,
      collapseGroups: false,
      removeComments: false,
    });
    expect(typeof result.saving).toBe("number");
  });

  it("throws a friendly error for invalid XML input", () => {
    expect(() => optimizeSvg("not xml at all <<<", DEFAULT_OPTS)).toThrow(
      /not an SVG|valid SVG|SVG markup|well-formed/i
    );
  });

  it("converts shapes to paths when convertShapes=true", () => {
    const rectSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect x="10" y="10" width="80" height="80"/>
    </svg>`;
    const result = optimizeSvg(rectSvg, { ...DEFAULT_OPTS, convertShapes: true });
    // rect should become a path element
    expect(result.optimized).toContain("<path");
    expect(result.optimized).not.toContain("<rect");
  });
});

describe("parseFriendlyError", () => {
  it("maps SAX whitespace error to a helpful message", () => {
    const msg = parseFriendlyError("Non-whitespace before first tag.");
    expect(msg).toMatch(/valid SVG|SVG markup/i);
    expect(msg).not.toContain("Non-whitespace");
  });

  it("maps parse error to a helpful message", () => {
    const msg = parseFriendlyError("Parse error at line 1");
    expect(msg).toMatch(/valid SVG|well-formed|SVG markup/i);
  });

  it("returns a generic message for unknown errors", () => {
    const msg = parseFriendlyError("something completely unexpected");
    expect(msg).toMatch(/SVG/i);
  });
});

describe("toDataUri", () => {
  it("produces a data URI with svg+xml type", () => {
    const uri = toDataUri("<svg/>");
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it("encodes the SVG content", () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>';
    const uri = toDataUri(svg);
    // The content should be percent-encoded
    expect(uri).toContain("%3C");
  });
});

describe("toBase64DataUri", () => {
  it("produces a base64 data URI", () => {
    const uri = toBase64DataUri("<svg/>");
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("can be decoded back to the original", () => {
    const svg = "<svg/>";
    const uri = toBase64DataUri(svg);
    const b64 = uri.replace("data:image/svg+xml;base64,", "");
    // Should successfully atob without throwing
    expect(() => atob(b64)).not.toThrow();
  });
});

describe("toJsxComponent", () => {
  it("wraps SVG in a React component function", () => {
    const jsx = toJsxComponent('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
    expect(jsx).toContain("export function SvgIcon");
    expect(jsx).toContain("React.SVGProps<SVGSVGElement>");
  });

  it("converts class= to className=", () => {
    const jsx = toJsxComponent('<svg><g class="foo"/></svg>');
    expect(jsx).toContain("className=");
    expect(jsx).not.toContain(" class=");
  });

  it("converts stroke-width to strokeWidth", () => {
    const jsx = toJsxComponent('<svg><path stroke-width="2"/></svg>');
    expect(jsx).toContain("strokeWidth=");
    expect(jsx).not.toContain("stroke-width=");
  });

  it("accepts a custom component name", () => {
    const jsx = toJsxComponent("<svg/>", "MyIcon");
    expect(jsx).toContain("export function MyIcon");
  });

  it("removes XML comments from output", () => {
    const jsx = toJsxComponent("<svg><!-- a comment --><circle/></svg>");
    expect(jsx).not.toContain("<!-- a comment -->");
  });
});

describe("byteLength", () => {
  it("returns byte length for ASCII", () => {
    expect(byteLength("abc")).toBe(3);
  });

  it("returns byte length for multibyte chars", () => {
    // euro sign = 3 bytes in UTF-8
    expect(byteLength("€")).toBe(3);
  });
});

describe("formatBytes", () => {
  it("formats bytes below 1024 as B", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatBytes(1024 * 1024 * 1.5)).toBe("1.50 MB");
  });
});


describe("optimizeSvg input validation", () => {
  it("throws for empty input", () => {
    expect(() => optimizeSvg("", DEFAULT_OPTS)).toThrow(/not an SVG/i);
  });

  it("throws for whitespace-only input", () => {
    expect(() => optimizeSvg("   ", DEFAULT_OPTS)).toThrow(/not an SVG/i);
  });

  it("throws for non-SVG HTML input", () => {
    expect(() =>
      optimizeSvg("<html><body><p>Hello</p></body></html>", DEFAULT_OPTS)
    ).toThrow(/not an SVG/i);
  });

  it("throws for plain text input", () => {
    expect(() => optimizeSvg("just some text", DEFAULT_OPTS)).toThrow(/not an SVG/i);
  });

  it("does not throw for valid SVG input", () => {
    expect(() =>
      optimizeSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
        DEFAULT_OPTS
      )
    ).not.toThrow();
  });
});
