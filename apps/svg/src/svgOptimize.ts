// Pure SVGO-backed optimization logic.
// Import from svgo/browser (the browser-safe build without Node.js fs/path deps).
import type { PluginConfig } from "svgo/browser";
import { optimize } from "svgo/browser";

/**
 * Converts a raw SVGO/parser exception message into a plain-language string
 * that is safe to display directly to the user.
 *
 * SVGO surfaces SAX parser errors like "Non-whitespace before first tag" which
 * mean nothing to someone who just pasted the wrong content. We map known
 * patterns to friendly messages and fall back to a generic one-liner.
 */
export function parseFriendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("non-whitespace before first tag") ||
    lower.includes("unexpected token") ||
    lower.includes("invalid xml") ||
    lower.includes("parse error") ||
    lower.includes("end tag") ||
    lower.includes("mismatched") ||
    lower.includes("unmatched")
  ) {
    return "This doesn't look like valid SVG. Paste the full <svg>...</svg> markup.";
  }
  if (lower.includes("svg") && lower.includes("root")) {
    return "No <svg> root element found. Make sure you're pasting the complete SVG markup.";
  }
  return "Could not parse this as SVG. Check that it is well-formed XML with an <svg> root.";
}

export interface OptimizeOptions {
  /** Numeric precision for coordinates (1-8). Maps to SVGO's `floatPrecision`. */
  precision: number;
  /** Strip editor metadata (inkscape, sodipodi, title, desc, doctype, XML PI) */
  stripMetadata: boolean;
  /** Collapse redundant/empty groups */
  collapseGroups: boolean;
  /** (reserved) */
  removeViewBox: boolean;
  /** Remove XML comments */
  removeComments: boolean;
  /** Convert basic shapes (rect, circle, etc.) to optimized path data */
  convertShapes: boolean;
  /** Minify and de-duplicate element IDs */
  cleanupIds: boolean;
}

export interface OptimizeResult {
  optimized: string;
  originalBytes: number;
  optimizedBytes: number;
  /** Saving as a fraction 0..1 */
  saving: number;
}

export function byteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function optimizeSvg(input: string, opts: OptimizeOptions): OptimizeResult {
  const originalBytes = byteLength(input);

  // Build the plugin list from user options. We use preset-default as the base and
  // add/remove plugins by including or excluding them from the array.
  // SVGO 4's PluginConfig type requires either a string name or { name, params } shape.
  const plugins: PluginConfig[] = [
    // Core optimizations always on
    "cleanupAttrs",
    "mergeStyles",
    "inlineStyles",
    "minifyStyles",
    "removeUselessDefs",
    { name: "cleanupNumericValues", params: { floatPrecision: opts.precision } },
    "convertColors",
    "removeUnknownsAndDefaults",
    "removeNonInheritableGroupAttrs",
    "removeUselessStrokeAndFill",
    "removeHiddenElems",
    "removeEmptyText",
    "convertEllipseToCircle",
    "moveElemsAttrsToGroup",
    "moveGroupAttrsToElems",
    { name: "convertPathData", params: { floatPrecision: opts.precision } },
    { name: "convertTransform", params: { floatPrecision: opts.precision } },
    "removeEmptyAttrs",
    "removeEmptyContainers",
    "mergePaths",
    "sortAttrs",
    "sortDefsChildren",
    "removeDeprecatedAttrs",
  ];

  if (opts.cleanupIds) {
    plugins.push("cleanupIds");
  }

  if (opts.convertShapes) {
    plugins.push("convertShapeToPath");
  }

  if (opts.collapseGroups) {
    plugins.push("collapseGroups");
  }

  if (opts.removeComments) {
    plugins.push("removeComments");
  }

  if (opts.stripMetadata) {
    plugins.push(
      "removeDoctype",
      "removeXMLProcInst",
      "removeMetadata",
      "removeEditorsNSData",
      "removeTitle",
      // removeAny:true removes all <desc>, not just generator-produced ones
      { name: "removeDesc", params: { removeAny: true } }
    );
  }

  let result: { data: string };
  try {
    result = optimize(input, {
      multipass: true,
      floatPrecision: opts.precision,
      plugins,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(parseFriendlyError(raw));
  }

  const optimizedBytes = byteLength(result.data);
  const saving = originalBytes > 0 ? 1 - optimizedBytes / originalBytes : 0;

  return {
    optimized: result.data,
    originalBytes,
    optimizedBytes,
    saving,
  };
}

/**
 * Converts SVG markup to a data: URI suitable for use in <img src="..."> or CSS url().
 */
export function toDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Converts SVG markup to a base64-encoded data: URI.
 */
export function toBase64DataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/**
 * Converts SVG markup to a React JSX component string (inline, no imports).
 * Attribute transformations: class -> className, for -> htmlFor, etc.
 */
export function toJsxComponent(svg: string, componentName = "SvgIcon"): string {
  // Minimal SVG->JSX attribute transforms (covers the most common ones)
  const jsx = svg
    .replace(/\bclass=/g, "className=")
    .replace(/\bfor=/g, "htmlFor=")
    .replace(/\bxlink:href=/g, "xlinkHref=")
    .replace(/\bxmlns:xlink="[^"]*"/g, "")
    .replace(/\bxml:space="[^"]*"/g, "")
    // camelCase hyphenated SVG attributes
    .replace(/\bstroke-width=/g, "strokeWidth=")
    .replace(/\bstroke-linecap=/g, "strokeLinecap=")
    .replace(/\bstroke-linejoin=/g, "strokeLinejoin=")
    .replace(/\bstroke-dasharray=/g, "strokeDasharray=")
    .replace(/\bstroke-dashoffset=/g, "strokeDashoffset=")
    .replace(/\bfill-opacity=/g, "fillOpacity=")
    .replace(/\bfill-rule=/g, "fillRule=")
    .replace(/\bclip-path=/g, "clipPath=")
    .replace(/\bclip-rule=/g, "clipRule=")
    .replace(/\bstop-color=/g, "stopColor=")
    .replace(/\bstop-opacity=/g, "stopOpacity=")
    .replace(/\bfont-size=/g, "fontSize=")
    .replace(/\bfont-family=/g, "fontFamily=")
    .replace(/\bfont-weight=/g, "fontWeight=")
    .replace(/\btext-anchor=/g, "textAnchor=")
    .replace(/\bmarker-start=/g, "markerStart=")
    .replace(/\bmarker-end=/g, "markerEnd=")
    .replace(/\bmarker-mid=/g, "markerMid=")
    // Remove XML comments (JSX doesn't support them in element context)
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();

  return `export function ${componentName}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx.replace(/\n/g, "\n    ")}\n  );\n}`;
}
