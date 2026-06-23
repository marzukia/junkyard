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
  if (!input.trim()) throw new Error("Input is not an SVG: received empty string.");
  if (!/<svg[\s>]/i.test(input)) throw new Error("Input is not an SVG: no <svg> root element found.");
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
 * Uses TextEncoder for a correct UTF-8-safe base64 encode — avoids the
 * deprecated unescape() which corrupts non-ASCII characters.
 */
export function toBase64DataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/**
 * Converts SVG markup to a React JSX component string (inline, no imports).
 * Attribute transformations: class -> className, for -> htmlFor, etc.
 */
/** Apply JSX attribute renames inside a single opening/closing tag string. */
function transformTagAttributes(tag: string): string {
  // Process attribute names only. Each attribute in XML is: name="value" or name={expr}.
  // We operate token-by-token: consume the tag character-by-character,
  // tracking whether we are inside a quoted value or not.
  let out = "";
  let i = 0;
  while (i < tag.length) {
    const ch = tag[i];
    if (ch === '"' || ch === "'") {
      // Quoted attribute value: copy verbatim until closing quote
      const quote = ch;
      out += ch;
      i++;
      while (i < tag.length && tag[i] !== quote) {
        out += tag[i++];
      }
      if (i < tag.length) {
        out += tag[i++]; // closing quote
      }
    } else if (ch === "{") {
      // JSX expression value: copy verbatim until closing }
      let depth = 1;
      out += ch;
      i++;
      while (i < tag.length && depth > 0) {
        if (tag[i] === "{") depth++;
        else if (tag[i] === "}") depth--;
        out += tag[i++];
      }
    } else {
      out += ch;
      i++;
    }
  }
  // Now apply attribute name rewrites to the regions OUTSIDE quoted values.
  // Since we've already built 'out' with quoted regions verbatim, we need a different
  // approach: split on quoted values, rewrite only the unquoted segments.
  return rewriteAttrNames(tag);
}

const ATTR_REWRITES: [RegExp, string][] = [
  [/(?<=[\s<])class=/g, "className="],
  [/(?<=[\s<])for=/g, "htmlFor="],
  [/(?<=[\s<])xlink:href=/g, "xlinkHref="],
  [/(?<=[\s<])xmlns:xlink="[^"]*"/g, ""],
  [/(?<=[\s<])xml:space="[^"]*"/g, ""],
  [/(?<=[\s<])stroke-width=/g, "strokeWidth="],
  [/(?<=[\s<])stroke-linecap=/g, "strokeLinecap="],
  [/(?<=[\s<])stroke-linejoin=/g, "strokeLinejoin="],
  [/(?<=[\s<])stroke-dasharray=/g, "strokeDasharray="],
  [/(?<=[\s<])stroke-dashoffset=/g, "strokeDashoffset="],
  [/(?<=[\s<])fill-opacity=/g, "fillOpacity="],
  [/(?<=[\s<])fill-rule=/g, "fillRule="],
  [/(?<=[\s<])clip-path=/g, "clipPath="],
  [/(?<=[\s<])clip-rule=/g, "clipRule="],
  [/(?<=[\s<])stop-color=/g, "stopColor="],
  [/(?<=[\s<])stop-opacity=/g, "stopOpacity="],
  [/(?<=[\s<])font-size=/g, "fontSize="],
  [/(?<=[\s<])font-family=/g, "fontFamily="],
  [/(?<=[\s<])font-weight=/g, "fontWeight="],
  [/(?<=[\s<])text-anchor=/g, "textAnchor="],
  [/(?<=[\s<])marker-start=/g, "markerStart="],
  [/(?<=[\s<])marker-end=/g, "markerEnd="],
  [/(?<=[\s<])marker-mid=/g, "markerMid="],
];

/**
 * Rewrite SVG attribute names in a string, touching only content OUTSIDE quoted values.
 * Strategy: split the string on quoted-value boundaries, apply rewrites only to
 * the unquoted segments (attribute names, tag punctuation), then reassemble.
 */
function rewriteAttrNames(s: string): string {
  // Split on double-quoted segments: capture both the delimiters and the content.
  // Pattern: ("(?:[^"\\]|\\.)*") captures a double-quoted string.
  const parts = s.split(/((?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'))/);
  return parts
    .map((part, idx) => {
      // Even-indexed parts are between quoted values (unquoted context) -- apply rewrites.
      // Odd-indexed parts are quoted values -- copy verbatim.
      if (idx % 2 === 0) {
        let result = part;
        for (const [re, replacement] of ATTR_REWRITES) {
          result = result.replace(re, replacement);
        }
        return result;
      }
      return part;
    })
    .join("");
}

export function toJsxComponent(svg: string, componentName = "SvgIcon"): string {
  // Remove XML comments first (they are never attribute content).
  const noComments = svg.replace(/<!--[\s\S]*?-->/g, "");
  // Apply attribute rewrites only in unquoted regions (attribute names / tag punctuation).
  const jsx = rewriteAttrNames(noComments).trim();

  return `export function ${componentName}(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    ${jsx.replace(/\n/g, "\n    ")}\n  );\n}`;
}
